
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { Conversation } from "@/api/entities";
import TopicCard from "../components/topics/TopicCard";
import TopicDialog from "../components/topics/TopicDialog";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/utils/toast";
import { useLanguage } from '@/components/utils/i18n';
import { 
  Filter, 
  Flame, 
  MessageCircle, 
  Users, 
  TrendingUp,
  SortAsc,
  SortDesc,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Globe
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import SearchBar from "../components/topics/SearchBar";
import PostOpinionDialog from "../components/topics/PostOpinionDialog";
import { delay, retryWithBackoff } from "../components/utils/apiHelpers";
import { UserProfile } from "@/api/entities";
import InvitationPreviewModal from "../components/topics/InvitationPreviewModal";
import NewMessagesModal from "../components/topics/NewMessagesModal";
import { Message } from "@/api/entities";
import { AnimatePresence, motion } from "framer-motion";

import TopicDetailDialog from "../components/topics/TopicDetailDialog";
import StatsDialog from "../components/topics/StatsDialog";

export default function TopicsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();  // Add currentLanguage from useLanguage
  const { showToast, toast } = useAppToast();
  
  // Get all URL parameters
  const urlParams = new URLSearchParams(location.search);
  const filterMode = urlParams.get('filterMode');
  const initialTags = urlParams.get('tags')?.split(',').filter(Boolean) || [];
  const initialSortBy = urlParams.get('sortBy') || 'heat';
  const initialSortOrder = urlParams.get('sortOrder') || 'desc';

  // Add a ref to track if initial load is done
  const initialLoadDone = React.useRef(false);
  
  // Initialize selectedLanguages with current language from URL params or current language
  const urlLanguages = urlParams.get('languages')?.split(',').filter(Boolean);
  const [selectedLanguages, setSelectedLanguages] = useState(urlLanguages || [currentLanguage]);
  
  const [topics, setTopics] = useState([]);
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);
  const [userOpinions, setUserOpinions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [userId, setUserId] = useState(null);
  const [topicStats, setTopicStats] = useState({});
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [showPostOpinionDialog, setShowPostOpinionDialog] = useState(false);
  const [lastSavedTopicId, setLastSavedTopicId] = useState(null);
  const [userConversations, setUserConversations] = useState({});
  const [pendingInvitations, setPendingInvitations] = useState({});
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [selectedTopicForInvitations, setSelectedTopicForInvitations] = useState(null);
  const [topicInvitations, setTopicInvitations] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  
  // New state for handling new messages
  const [activeConversationsWithNewMessages, setActiveConversationsWithNewMessages] = useState({});
  const [showNewMessagesModal, setShowNewMessagesModal] = useState(false);
  const [selectedTopicForMessages, setSelectedTopicForMessages] = useState(null);
  const [topicNewMessages, setTopicNewMessages] = useState([]);

  // Store dialog state in URL search params
  const dialogTopicId = urlParams.get('dialog');

  // Add toggleFilters function
  const toggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

    // new state
  const [acceptedInvitations, setAcceptedInvitations] = useState({});
    // new state
  const [showInactive, setShowInactive] = useState(false);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'he', name: 'עברית' },
    { code: 'ar', name: 'العربية' }
  ];

  // Now allTags and tagCounts can safely access selectedLanguages
  const allTags = useMemo(() => {
    const tagSet = new Set();
    
    // Filter topics by selected languages first
    let relevantTopics = topics;
    if (selectedLanguages.length > 0) {
      relevantTopics = topics.filter(topic => {
        // Check if topic has matching language property
        if (topic.language && selectedLanguages.includes(topic.language)) {
          return true;
        }
        
        // Check if topic has language tag
        if (topic.tags) {
          return selectedLanguages.some(lang => 
            topic.tags.some(tag => 
              tag === `lang:${lang}` || 
              tag === lang
            )
          );
        }
        
        return false;
      });
    }

    // Get tags only from relevant topics
    relevantTopics.forEach(topic => {
      if (topic.tags && Array.isArray(topic.tags)) {
        // Filter out language tags
        const nonLanguageTags = topic.tags.filter(tag => 
          !tag.startsWith('lang:') && 
          !['he', 'ar', 'en'].includes(tag)
        );
        nonLanguageTags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [topics, selectedLanguages]);

  const tagCounts = useMemo(() => {
    const counts = {};
    
    // Filter topics by selected languages first
    let relevantTopics = topics;
    if (selectedLanguages.length > 0) {
      relevantTopics = topics.filter(topic => {
        if (topic.language && selectedLanguages.includes(topic.language)) {
          return true;
        }
        
        if (topic.tags) {
          return selectedLanguages.some(lang => 
            topic.tags.some(tag => 
              tag === `lang:${lang}` || 
              tag === lang
            )
          );
        }
        
        return false;
      });
    }

    // Count tags only from relevant topics
    relevantTopics.forEach(topic => {
      if (topic.tags && Array.isArray(topic.tags)) {
        // Filter out language tags when counting
        const nonLanguageTags = topic.tags.filter(tag => 
          !tag.startsWith('lang:') && 
          !['he', 'ar', 'en'].includes(tag)
        );
        nonLanguageTags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return counts;
  }, [topics, selectedLanguages]);

  // Add a version flag to ensure our cached data is valid when schema changes
  const CACHE_VERSION = "v1.2";

  // Improve the initial loading state
  useEffect(() => {
    console.log("[Topics] Initial load with dialogTopicId:", dialogTopicId);
    
    // First, check if we have any cached topics - even stale ones
    const cachedData = localStorage.getItem('topicsPageData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        if (parsedData.version === CACHE_VERSION) {
          // Show cached data immediately while loading fresh data
          setTopics(parsedData.topics || []);
          setUserOpinions(parsedData.opinions || {});
          setTopicStats(parsedData.stats || {});
          console.log("[Topics] Showing cached data while loading fresh data");
        }
      } catch (e) {
        console.error("Error parsing cached topics data:", e);
      }
    }
    
    // Always load fresh data, but prioritize visual content
    loadData();
  }, [currentLanguage]); // Add currentLanguage as dependency

  // Add a new effect to apply initial tag filters from onboarding
  useEffect(() => {
    const initialTagFilters = localStorage.getItem('initial_tag_filters');
    if (initialTagFilters) {
      try {
        const tags = JSON.parse(initialTagFilters);
        if (Array.isArray(tags) && tags.length > 0) {
          console.log("[Topics] Applying initial tag filters:", tags);
          setSelectedTags(tags);
          // Remove from localStorage so it's only applied once
          localStorage.removeItem('initial_tag_filters');
        }
      } catch (error) {
        console.error("Error parsing initial tag filters:", error);
      }
    }
  }, []);

  // Update the useEffect that handles URL parameters to properly show the dialog
  useEffect(() => {
    if (dialogTopicId && topics.length > 0) {
      const topic = topics.find(t => t.id === dialogTopicId);
      if (topic) {
        console.log("[Topics] Opening dialog for topic from URL parameter:", topic.id);
        setSelectedTopic(topic);
        setShowDetailDialog(true);
      }
    }
  }, [dialogTopicId, topics]);

  // Move getSortedTopics outside of the render to use in loadData
  const sortTopics = (topicsToSort, topicStatsData) => {
    if (!topicsToSort.length) return [];
    
    let filteredTopics = topicsToSort;
    
    if (selectedTags.length > 0) {
      if (filterMode === 'union') {
        filteredTopics = filteredTopics.filter(topic => 
          selectedTags.some(tag => topic.tags && topic.tags.includes(tag))
        );
      } else {
        filteredTopics = filteredTopics.filter(topic => 
          selectedTags.every(tag => topic.tags && topic.tags.includes(tag))
        );
      }
    }
    
    // Convert stats to numeric values once
    const numericStats = {};
    filteredTopics.forEach(topic => {
      const stats = topicStatsData[topic.id] || { 
        totalDiscussions: 0, 
        totalOpinions: 0, 
        activeDiscussions: 0,
        heatScore: 0
      };
      
      numericStats[topic.id] = {
        totalDiscussions: stats.totalDiscussions === '...' ? 0 : Number(stats.totalDiscussions),
        totalOpinions: stats.totalOpinions === '...' ? 0 : Number(stats.totalOpinions),
        activeDiscussions: stats.activeDiscussions === '...' ? 0 : Number(stats.activeDiscussions),
        heatScore: stats.heatScore || 0
      };
    });
    
    return [...filteredTopics].sort((a, b) => {
      const statsA = numericStats[a.id];
      const statsB = numericStats[b.id];
      
      let comparison = 0;
      
      switch (sortBy) {
        case 'heat':
          comparison = (statsB.heatScore || 0) - (statsA.heatScore || 0);
          break;
          
        case 'discussions':
          comparison = statsB.totalDiscussions - statsA.totalDiscussions;
          break;
          
        case 'active':
          comparison = statsB.activeDiscussions - statsA.activeDiscussions;
          break;
          
        case 'opinions':
          comparison = statsB.totalOpinions - statsA.totalOpinions;
          break;
          
        case 'newest':
          comparison = new Date(b.created_date) - new Date(a.created_date);
          break;
          
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? comparison : -comparison;
    });
  };

  // Update loadData to better handle opinions count
  const loadData = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      console.log("[Topics] Starting data load");
      
      // Always load fresh data when requesting inactive topics
      const shouldForceRefresh = forceRefresh || showInactive;
      
      // 1. Check cache only if not forcing refresh
      if (!shouldForceRefresh) {
        const cachedData = localStorage.getItem('topicsPageData');
        const lastUpdate = localStorage.getItem('lastTopicUpdate');
        
        if (cachedData && (!lastUpdate || new Date(JSON.parse(cachedData).timestamp) > new Date(lastUpdate))) {
          try {
            const parsedData = JSON.parse(cachedData);
            if (parsedData.version === CACHE_VERSION) {
              setTopics(parsedData.topics || []);
              setUserOpinions(parsedData.opinions || {});
              setTopicStats(parsedData.stats || {});
              console.log("[Topics] Using cached data initially");
              setIsLoading(false); // Show cached content immediately
            }
          } catch (e) {
            console.error("Error parsing cached topics data:", e);
          }
        }
      }

      // Always load fresh data
      const loadTopicsPromise = Topic.list("-created_date", 50);  // Increased limit to get all topics including inactive
      const loadUserPromise = User.me();

      // Execute both promises in parallel
      const [topicsData, user] = await Promise.all([
        loadTopicsPromise,
        loadUserPromise
      ]);

      // Only show error toast if we actually have no topics
      if (!topicsData || topicsData.length === 0) {
        console.log("[Topics] No topics found");
        // Don't show error toast - empty state will be handled by UI
      } else {
        console.log("[Topics] Loaded topics:", topicsData.length);
      }

      // Continue with existing code...
      const initialStats = {};
      topicsData.forEach(topic => {
        initialStats[topic.id] = {
          totalDiscussions: 0,
          totalOpinions: 0,
          activeDiscussions: 0,
          heatScore: 0,
          recentActivity: false
        };
      });

      // Update state with fresh data
      setTopics(topicsData);
      setTopicStats(initialStats);
      setIsLoading(false); // Ensure loading is false once we have basic data
      
      if (user?.id) {
        setUserId(user.id);
        
        // Load invitations as early as possible
        loadInvitations(user.id);
        
        // Load user opinions in the background - but just once and cache it
        try {
          const userOpinions = await TopicOpinion.filter({ user_id: user.id });
          const opinionMap = {};
          userOpinions.forEach(opinion => {
            opinionMap[opinion.topic_id] = opinion;
          });
          setUserOpinions(opinionMap);
          
          // Cache user opinions
          const cachedData = localStorage.getItem('topicsPageData');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            localStorage.setItem('topicsPageData', JSON.stringify({
              ...parsedData,
              opinions: opinionMap,
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          console.error("Error loading user opinions:", error);
        }

        // Rate-limit the conversation loading
        setTimeout(async () => {
          try {
            // Load only essential conversation data - just counts
            const allConversations = await Conversation.list();
            
            // Process conversations and update stats
            const conversationStats = {};
            allConversations.forEach(conv => {
              if (!conversationStats[conv.topic_id]) {
                conversationStats[conv.topic_id] = { total: 0, active: 0 };
              }
              conversationStats[conv.topic_id].total++;
              if (conv.status === "active") {
                conversationStats[conv.topic_id].active++;
              }
            });

            // Update stats
            setTopicStats(prev => {
              const updated = { ...prev };
              Object.entries(conversationStats).forEach(([topicId, stats]) => {
                if (updated[topicId]) {
                  updated[topicId] = {
                    ...updated[topicId],
                    totalDiscussions: stats.total,
                    activeDiscussions: stats.active
                  };
                }
              });
              return updated;
            });
            
            // Update cache with conversation stats
            const cachedData = localStorage.getItem('topicsPageData');
            if (cachedData) {
              try {
                const parsedData = JSON.parse(cachedData);
                const updatedStats = { ...parsedData.stats };
                
                Object.entries(conversationStats).forEach(([topicId, stats]) => {
                  if (updatedStats[topicId]) {
                    updatedStats[topicId] = {
                      ...updatedStats[topicId],
                      totalDiscussions: stats.total,
                      activeDiscussions: stats.active
                    };
                  }
                });
                
                localStorage.setItem('topicsPageData', JSON.stringify({
                  ...parsedData,
                  stats: updatedStats,
                  timestamp: Date.now()
                }));
              } catch (e) {
                console.error("Error updating cached topics stats:", e);
              }
            }
          } catch (error) {
            console.error("Error loading conversations:", error);
          }
        }, 1000); // Delay by 1 second
        
        // LOAD ALL OPINIONS AT ONCE FOR ACCURATE COUNTS
        setTimeout(async () => {
          try {
            // Load all opinions across all topics for accurate counts
            const allOpinions = await TopicOpinion.list("-created_date", 200);
            
            // Group by topic
            const opinionsByTopic = {};
            allOpinions.forEach(opinion => {
              if (!opinionsByTopic[opinion.topic_id]) {
                opinionsByTopic[opinion.topic_id] = [];
              }
              opinionsByTopic[opinion.topic_id].push(opinion);
            });
            
            // Update stats for all topics
            setTopicStats(prev => {
              const updated = { ...prev };
              Object.entries(opinionsByTopic).forEach(([topicId, topicOpinions]) => {
                if (updated[topicId]) {
                  updated[topicId] = {
                    ...updated[topicId],
                    totalOpinions: topicOpinions.length,
                    heatScore: calculateHeatScore(topicOpinions.length, updated[topicId])
                  };
                }
              });
              return updated;
            });
            
            // Update cache with all opinion counts
            const cachedData = localStorage.getItem('topicsPageData');
            if (cachedData) {
              try {
                const parsedData = JSON.parse(cachedData);
                const updatedStats = { ...parsedData.stats };
                
                Object.entries(opinionsByTopic).forEach(([topicId, topicOpinions]) => {
                  if (updatedStats[topicId]) {
                    updatedStats[topicId] = {
                      ...updatedStats[topicId],
                      totalOpinions: topicOpinions.length,
                      heatScore: calculateHeatScore(topicOpinions.length, updatedStats[topicId])
                    };
                  }
                });
                
                localStorage.setItem('topicsPageData', JSON.stringify({
                  ...parsedData,
                  stats: updatedStats,
                  timestamp: Date.now()
                }));
              } catch (e) {
                console.error("Error updating cached topics stats:", e);
              }
            }
          } catch (error) {
            console.error("Error loading all opinions:", error);
          }
        }, 1500); // Delay by 1.5 seconds to avoid rate limiting
      }

      // Update cache with fresh topic data
      localStorage.setItem('topicsPageData', JSON.stringify({
        topics: topicsData,
        opinions: {},
        stats: initialStats,
        timestamp: Date.now(),
        version: CACHE_VERSION
      }));

    } catch (error) {
      console.error("Error loading topics:", error);
      // Only show error toast for actual errors, not empty results
      if (error?.message !== "No topics found") {
        showToast(
          "Error loading topics",
          "Please try again later",
          "destructive"
        );
      }
    }
    setIsLoading(false);
  };

  // Add effect to reload data when cache is invalidated
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'lastTopicUpdate' || e.key === null) {
        loadData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Helper function to calculate heat score
  const calculateHeatScore = (opinionCount, currentStats) => {
    return (
      (opinionCount * 2) +
      ((currentStats?.totalDiscussions || 0) * 3) +
      ((currentStats?.activeDiscussions || 0) * 5)
    );
  };

  // Update the loadInvitations function to properly fetch and format invitations
  const loadInvitations = async (uid) => {
    if (!uid) return;
    try {
      const cachedInvitations = localStorage.getItem('cachedInvitations');
      const lastCacheTime = parseInt(localStorage.getItem('invitationsCacheTime') || '0');
      const now = Date.now();
      
      // If we have recent cached data, use it first
      if (cachedInvitations && now - lastCacheTime < 300000) {
        try {
          const parsedInvites = JSON.parse(cachedInvitations);
          // Convert array to object keyed by topic_id for easier lookup
          const invitationsMap = {};
          parsedInvites.forEach(inv => {
            invitationsMap[inv.topic_id] = inv;
          });
          setPendingInvitations(invitationsMap);
          console.log("[Topics] Loaded cached invitations:", parsedInvites.length);
        } catch (e) {
          console.error("Error parsing cached invitations:", e);
        }
      }
      
      // Fetch fresh data with specific fields we need for invitations
      console.log("[Topics] Fetching fresh invitations for user:", uid);
      const invitedConversations = await Conversation.filter({ 
        participant2_id: uid,
        status: "invited"
      }, "-created_date");
      
      console.log("[Topics] Fetched invitations count:", invitedConversations.length);
      
      // Convert array to object keyed by topic_id for easier lookup
      const invitationsMap = {};
      invitedConversations.forEach(inv => {
        invitationsMap[inv.topic_id] = inv;
      });
      
      setPendingInvitations(invitationsMap);
      
      // Store raw array in cache (smaller footprint)
      localStorage.setItem('cachedInvitations', JSON.stringify(invitedConversations));
      localStorage.setItem('invitationsCacheTime', now.toString());
      
      // If we have new invitations, show a notification
      const prevCount = Object.keys(pendingInvitations).length;
      if (invitedConversations.length > prevCount && prevCount !== 0) {
        toast({
          title: "New invitation received",
          description: "You have a new discussion invitation",
          action: (
            <Button onClick={() => navigate(createPageUrl("FindPartners"))}>
              View
            </Button>
          )
        });
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  };

  // Update effect to only set default language on initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      if (selectedLanguages.length === 0) {
        setSelectedLanguages([currentLanguage]);
      }
      initialLoadDone.current = true;
    }
  }, [currentLanguage]);

  // Update handleLanguageSelect to allow complete freedom after initial load
  const handleLanguageSelect = (lang) => {
    const newSelectedLangs = selectedLanguages.includes(lang)
      ? selectedLanguages.filter(l => l !== lang)
      : [...selectedLanguages, lang];
    
    // Update selected languages (allow empty array)
    setSelectedLanguages(newSelectedLangs);
    
    // Update URL
    const params = new URLSearchParams(location.search);
    if (newSelectedLangs.length > 0) {
      params.set('languages', newSelectedLangs.join(','));
    } else {
      params.delete('languages');
    }
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  // Add function to handle viewing invitations
  const handleViewInvitations = async (topic) => {
    console.log("[Topics] Viewing invitations for topic:", topic.id);
    setSelectedTopicForInvitations(topic);
    
    // Filter invitations for this specific topic
    try {
      const user = await User.me();
      const topicInvites = await Conversation.filter({
        participant2_id: user.id,
        topic_id: topic.id,
        status: "invited"
      });
      
      // For each invitation, get the sender profile
      const invitationsWithDetails = await Promise.all(
        topicInvites.map(async (conv) => {
          const senderProfiles = await UserProfile.filter({ user_id: conv.participant1_id });
          return {
            conversation: conv,
            sender: senderProfiles[0] || null,
            id: conv.id
          };
        })
      );
      
      setTopicInvitations(invitationsWithDetails);
      setShowInvitationModal(true);
    } catch (error) {
      console.error("Error loading invitations for topic:", error);
      showToast("Error loading invitations", "Please try again", "destructive");
    }
  };
  
  // Add a new state to track viewed accepted conversations
  const [viewedAcceptedConversations, setViewedAcceptedConversations] = useState({});
  
  // Add a handler for when user clicks on an accepted invitation
  const handleViewAcceptedInvitation = (topic, conversation) => {
    // Mark this conversation as viewed
    setViewedAcceptedConversations(prev => ({
      ...prev,
      [conversation.id]: true
    }));
    
    // Store in localStorage for persistence across page reloads
    try {
      const stored = JSON.parse(localStorage.getItem('viewedAcceptedConversations') || '{}');
      stored[conversation.id] = true;
      localStorage.setItem('viewedAcceptedConversations', JSON.stringify(stored));
    } catch (e) {
      console.error("Error storing viewed conversations:", e);
    }
    
    // Navigate to the chat view for the accepted conversation
    navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`);
  };
  
  // Update the filter for displayed accepted invitations
  const getFilteredAcceptedInvitations = (topicId) => {
    const invitations = acceptedInvitations[topicId] || [];
    if (!invitations.length) return [];
    
    // Filter out any that have been viewed
    return invitations.filter(conv => !viewedAcceptedConversations[conv.id]);
  };
  
  // Load viewed conversations from localStorage on initial load
  useEffect(() => {
    try {
      const storedViewed = localStorage.getItem('viewedAcceptedConversations');
      if (storedViewed) {
        setViewedAcceptedConversations(JSON.parse(storedViewed));
      }
    } catch (e) {
      console.error("Error loading viewed conversations:", e);
    }
  }, []);
  
  // Add function to handle accepting invitation
  const handleAcceptInvitation = async (conversation) => {
    try {
      await Conversation.update(conversation.id, {
        status: "waiting"
      });
      
      showToast("Invitation accepted", "You can now start the conversation");
      setShowInvitationModal(false);
      
      // Navigate to conversation
      navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      showToast("Error accepting invitation", "Please try again", "destructive");
    }
  };
  
  // Add new function to handle viewing new messages
  const handleViewNewMessages = async (topic, conversations) => {
    console.log("[Topics] Viewing new messages for topic:", topic.id);
    setSelectedTopicForMessages(topic);
    
    // Use the passed conversations data
    setTopicNewMessages(conversations);
    setShowNewMessagesModal(true);
  };
  
  // Handle selecting a conversation to view
  const handleSelectConversation = (conversation) => {
    setShowNewMessagesModal(false);
    navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`);
  };

  // Update the getInvitationCountForTopic function to be more robust
  const getInvitationCountForTopic = (topicId) => {
    if (!topicId || !pendingInvitations) return 0;
    
    // Check if we have a direct match by topic ID
    const directMatch = pendingInvitations[topicId];
    if (directMatch) return 1;
    
    // Look through all invitations to find matches
    let count = 0;
    Object.values(pendingInvitations).forEach(invitation => {
      if (invitation && invitation.topic_id === topicId) {
        count++;
      }
    });
    
    return count;
  };

  // Add new state for detailed topic dialog and stats dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [selectedStatsType, setSelectedStatsType] = useState(null);

  const handleSelectTopic = (topic, mode = 'detail') => {
    console.log("[Topics] Selecting topic:", topic.id, "mode:", mode);
    
    setSelectedTopic(topic);
    
    if (mode === 'opinion') {
      // Open opinion dialog directly
      setShowDialog(true);
    } else if (mode === 'detail') {
      // Open detailed topic view - add safety check
      if (topic?.id) {
        setShowDetailDialog(true);
      } else {
        console.error("Invalid topic selected:", topic);
      }
    }
  };
  
  // Add new function to handle viewing stats
  const handleViewStats = (topic, statType) => {
    console.log("[Topics] Viewing stats for topic:", topic.id, "type:", statType);
    setSelectedTopic(topic);
    setSelectedStatsType(statType);
    setShowStatsDialog(true);
  };
  
  // Add function to handle inviting a user to discuss
  const handleInviteUser = (userId) => {
    if (selectedTopic) {
      // Navigate to find partners with both topic and user pre-selected
      navigate(`${createPageUrl("FindPartners")}?topicId=${selectedTopic.id}&inviteUserId=${userId}`);
    }
  };
  
  // Add new function to navigate to FindPartners with topic filter
  const handleFindPartners = (topic) => {
    console.log("[Topics] Finding partners for topic:", topic.id);
    
    // Navigate to FindPartners with the topic ID as a parameter
    navigate(`${createPageUrl("FindPartners")}?topicId=${topic.id}`);
  };

  const handleSaveOpinion = async (topicId, stance, reasoning) => {
    console.log("[Topics] Saving opinion for topic:", topicId, { stance, reasoning });
    try {
      // First ensure we have a valid user
      const user = await User.me();
      if (!user?.id) {
        showToast(
          "Authentication error",
          "Please log in to share your opinion",
          "destructive"
        );
        return false;
      }

      // Convert numeric stance to string enum value
      const stanceMap = {
        5: "strongly_agree",
        4: "agree",
        3: "neutral",
        2: "disagree",
        1: "strongly_disagree"
      };

      const stanceValue = stanceMap[stance] || "neutral";

      if (userOpinions[topicId]) {
        console.log("[Topics] Updating existing opinion");
        const updated = await TopicOpinion.update(userOpinions[topicId].id, {
          stance: stanceValue,
          reasoning: reasoning,
          willing_to_discuss: true
        });
        
        console.log("[Topics] Opinion updated successfully:", updated);
        
        setUserOpinions(prev => ({
          ...prev,
          [topicId]: {
            ...prev[topicId],
            stance: stanceValue,
            reasoning,
            willing_to_discuss: true
          }
        }));
      } else {
        console.log("[Topics] Creating new opinion with user:", user.id);
        const newOpinion = await TopicOpinion.create({
          user_id: user.id,
          topic_id: topicId,
          stance: stanceValue,
          reasoning: reasoning,
          willing_to_discuss: true
        });
        
        console.log("[Topics] New opinion created successfully:", newOpinion);
        
        setUserOpinions(prev => ({
          ...prev,
          [topicId]: newOpinion
        }));
        
        setTopicStats(prev => {
          const updatedStats = {...prev};
          if (updatedStats[topicId]) {
            updatedStats[topicId] = {
              ...updatedStats[topicId],
              totalOpinions: (updatedStats[topicId].totalOpinions || 0) + 1,
              heatScore: (updatedStats[topicId].heatScore || 0) + 5,
              recentActivity: true
            };
          }
          return updatedStats;
        });
      }
      
      // Clear all topic-related cache to ensure fresh data
      localStorage.removeItem('cachedTrendingTopics');
      localStorage.removeItem('topicsPageData');
      localStorage.setItem('opinionChanged', Date.now().toString());

      console.log("[Topics] Opinion save operation completed successfully");
      
      // Store the topic ID and show the post-opinion dialog
      setLastSavedTopicId(topicId);
      handleCloseDialog();
      setShowPostOpinionDialog(true);
      
      return true;
    } catch (error) {
      console.error("[Topics] Error saving opinion:", error);
      
      // More specific error messages
      if (error.response?.status === 422) {
        showToast(
          "Error saving opinion",
          "Please ensure you're logged in and try again",
          "destructive"
        );
      } else if (error.response?.status === 401) {
        showToast(
          "Authentication required",
          "Please log in to share your opinion",
          "destructive"
        );
        // Optionally redirect to login
        // navigate(createPageUrl("Landing"));
      } else {
        showToast(
          "Error saving opinion",
          "Please try again later",
          "destructive"
        );
      }
      return false;
    }
  };

  // Add handlers for post-opinion dialog
  const handleFindPartnersDialog = () => {
    setShowPostOpinionDialog(false);
    navigate(createPageUrl("FindPartners"));
  };

  const handleExploreTopics = () => {
    setShowPostOpinionDialog(false);
  };

  const handleCloseDialog = () => {
    console.log("[Topics] Closing dialog");
    
    // Remove dialog param from URL
    const newUrl = createPageUrl("Topics");
    window.history.pushState({}, '', newUrl);
    
    setShowDialog(false);
    setSelectedTopic(null);
  };

  // Update URL with all parameters
  const updateUrlParams = (updates) => {
    const params = new URLSearchParams(location.search);
    
    // Update provided parameters
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  // Handle sort selection
  const handleSortChange = (value) => {
    setSortBy(value);
    updateUrlParams({ sortBy: value });
  };

  // Handle order toggle
  const handleOrderToggle = () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newOrder);
    updateUrlParams({ sortOrder: newOrder });
  };

  // Use the sorting function in the memoized getSortedTopics
  const getSortedTopics = React.useMemo(() => {
    return sortTopics(searchResults || topics, topicStats);
  }, [topics, searchResults, selectedTags, filterMode, sortBy, sortOrder, topicStats]);
  
  // Update getDisplayedTopics to use the memoized sorted topics
  const getDisplayedTopics = () => {
    return getSortedTopics;
  };

  // Update tag selection to maintain the filter mode
  const handleTagSelect = (tag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    
    setSelectedTags(newTags);
    
    // Update URL to maintain state
    const params = new URLSearchParams(location.search);
    if (newTags.length > 0) {
      params.set('tags', newTags.join(','));
      if (filterMode) {
        params.set('filterMode', filterMode);
      }
    } else {
      params.delete('tags');
      params.delete('filterMode');
    }
    
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  // Update the handleSearchResults function
  const handleSearchResults = (results) => {
    // Apply current tag filters to search results
    let filteredResults = results;
    
    if (selectedTags.length > 0) {
      if (filterMode === 'union') {
        filteredResults = filteredResults.filter(topic => 
          selectedTags.some(tag => topic.tags && topic.tags.includes(tag))
        );
      } else {
        filteredResults = filteredResults.filter(topic => 
          selectedTags.every(tag => topic.tags && topic.tags.includes(tag))
        );
      }
    }
    
    setSearchResults(filteredResults);
  };

  const previousStatuses = useRef({});

  useEffect(() => {
    const checkForStatusChanges = async () => {
      try {
        const user = await User.me();
        const currentConversations = await Conversation.list();
        
        // Filter to get only user's conversations where they are the initiator (participant1)
        const userConversations = currentConversations.filter(conv => 
          conv.participant1_id === user.id
        );

        // Check for status changes
        userConversations.forEach(conv => {
          const prevStatus = previousStatuses.current[conv.id];
          
          // If this is a new conversation or status has changed to "waiting" or "active"
          if (prevStatus && 
              prevStatus === "invited" && 
              (conv.status === "waiting" || conv.status === "active")) {
            // Load other participant's profile
            const loadProfile = async () => {
              try {
                const profiles = await UserProfile.filter({ user_id: conv.participant2_id });
                const otherProfile = profiles[0];
                
                if (otherProfile) {
                  showToast(
                    "Invitation Accepted!",
                    `${otherProfile.display_name} accepted your conversation invitation`,
                    "default",
                    <Button 
                      onClick={() => navigate(`${createPageUrl("ChatView")}?id=${conv.id}`)}
                      size="sm"
                      className="mt-2"
                    >
                      View Conversation
                    </Button>
                  );
                  
                  // Force a data reload to update badges
                  loadData();
                }
              } catch (error) {
                console.error("Error loading profile:", error);
              }
            };
            
            loadProfile();
          }
          
          // Update the previous status
          previousStatuses.current[conv.id] = conv.status;
        });
        
      } catch (error) {
        console.error("Error checking for status changes:", error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkForStatusChanges, 30000);
    return () => clearInterval(interval);
  }, [navigate, showToast]);

  const [filters, setFilters] = useState({ 
    status: "all", 
    priority: "all", 
    category: "all",
    languages: [] 
  });

  // Update the filtered topics logic
  const filteredTopics = useMemo(() => {
    let filtered = topics;

    // Filter by active status
    if (!showInactive) {
      filtered = filtered.filter(topic => topic.active !== false);
    }

    // Apply language filter
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(topic => {
        // Check if topic has matching language property
        if (topic.language && selectedLanguages.includes(topic.language)) {
          return true;
        }
        
        // Check if topic has language tag
        if (topic.tags) {
          return selectedLanguages.some(lang => 
            // Look for explicit language tags like 'lang:he' or 'he'
            topic.tags.some(tag => 
              tag === `lang:${lang}` || 
              tag === lang
            )
          );
        }
        
        return false;
      });
    }

    // Apply existing tag filters
    if (selectedTags.length > 0) {
      if (filterMode === 'union') {
        filtered = filtered.filter(topic => 
          selectedTags.some(tag => topic.tags && topic.tags.includes(tag))
        );
      } else {
        filtered = filtered.filter(topic => 
          selectedTags.every(tag => topic.tags && topic.tags.includes(tag))
        );
      }
    }

    // Apply search filter if exists
    if (searchResults !== null) {
      filtered = searchResults.filter(topic => filtered.includes(topic));
    }

    return sortTopics(filtered, topicStats);
  }, [topics, searchResults, selectedTags, filterMode, selectedLanguages, showInactive, topicStats]);

  // Add useEffect to clear cache when active filter changes
  useEffect(() => {
    // When showing inactive topics filter is toggled, refresh data
    if (showInactive) {
      loadData();
    }
  }, [showInactive]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('explore_topics')}</h1>
          <p className="text-gray-600 mt-1">
            {t('explore_topics_description')}
          </p>
        </div>
      </header>

      <SearchBar 
        topics={topics}
        onSearchResults={handleSearchResults}
        onClearSearch={() => setSearchResults(null)}
        placeholder={t('search_topics_placeholder')}
      />

      {/* Simplified Language Filter */}
      

      {/* Add Sort Controls */}
      <div className="md:hidden mb-4">
        <Button 
          variant="outline" 
          onClick={toggleFilters}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            <span>{t('filter_and_sort')}</span>
          </div>
          {filtersExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className={`${filtersExpanded ? 'block' : 'hidden'} md:block`}>
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-col gap-4">
            {/* Language Filter - Now inside the filters box */}
            <div>
              <div className="flex flex-wrap gap-2">
                {languages.map((lang) => (
                  <Button
                    key={lang.code}
                    variant={selectedLanguages.includes(lang.code) ? "default" : "ghost"}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`text-sm ${
                      selectedLanguages.includes(lang.code)
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "hover:bg-gray-50"
                    }`}
                    size="sm"
                  >
                    {lang.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {t('tags_select_multiple')}
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {allTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    onClick={() => handleTagSelect(tag)}
                    className={`whitespace-nowrap ${
                      selectedTags.includes(tag)
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white font-medium" 
                        : "bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                    size="sm"
                  >
                    {tag} ({tagCounts[tag] || 0})
                  </Button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedTags([]);
                    const params = new URLSearchParams(location.search);
                    params.delete('tags');
                    params.delete('filterMode');
                    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                  }}
                  className="mt-2 text-sm text-gray-600"
                  size="sm"
                >
                  {t('clear_all_tags')}
                </Button>
              )}
            </div>

            <div className="flex gap-4 flex-wrap pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {t('sort_by')}
                </label>
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heat">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span>{t('sort_heat_score')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="discussions">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span>{t('sort_total_discussions')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span>{t('sort_active_discussions')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="opinions">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        <span>{t('sort_total_opinions')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="newest">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-indigo-500" />
                        <span>{t('sort_newest')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {t('sort_order')}
                </label>
                <Button
                  variant="outline"
                  onClick={handleOrderToggle}
                  className="h-10"
                >
                  {sortOrder === "desc" ? (
                    <SortDesc className="h-4 w-4" />
                  ) : (
                    <SortAsc className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* Add Admin-only Show Inactive Topics Toggle */}
              {userId === '64ca8596f919c2b063d01a59' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="show-inactive"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="show-inactive" className="ml-2 text-sm text-gray-700">
                      {t('Show inactive topics')}
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Show current sort in mobile view */}
      <div className="md:hidden mb-4">
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-gray-500">{t('sorted_by')}:</span>
          <Badge variant="outline" className="bg-gray-50 flex items-center gap-1">
            {sortBy === "heat" && <Flame className="h-3 w-3 text-orange-500" />}
            {sortBy === "discussions" && <MessageCircle className="h-3 w-3 text-blue-500" />}
            {sortBy === "active" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {sortBy === "opinions" && <Users className="h-3 w-3 text-purple-500" />}
            {sortBy === "newest" && <MessageCircle className="h-3 w-3 text-indigo-500" />}
            <span>
              {t(`sort_${sortBy}`)}
            </span>
            {sortOrder === "desc" ? "↓" : "↑"}
          </Badge>
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-gray-500">{t('filtering_by_tags')}:</span>
            {selectedTags.map(tag => (
              <Badge 
                key={tag}
                variant="outline" 
                className="bg-gray-50 flex items-center gap-1"
              >
                {tag}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTagSelect(tag);
                  }}
                />
              </Badge>
            ))}
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedTags([]);
                const params = new URLSearchParams(location.search);
                params.delete('tags');
                params.delete('filterMode');
                navigate(`${location.pathname}?${params.toString()}`, { replace: true });
              }}
              className="text-xs text-gray-600"
              size="sm"
            >
              {t('clear_all')}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-md animate-pulse">
              <div className="h-40 bg-gray-200"></div>
              <div className="p-4 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-10 bg-gray-200 rounded mt-4"></div>
              </div>
            </div>
          ))
        ) : filteredTopics.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">{t('no_topics_found')}</h3>
            <p className="text-gray-500 text-sm">
              {t('no_topics_found_description')}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredTopics.map((topic) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                layout
              >
                <TopicCard
                  topic={topic}
                  userOpinion={userOpinions[topic.id]}
                  onSelect={handleSelectTopic}
                  onFindPartners={handleFindPartners}
                  onViewInvitations={handleViewInvitations}
                  onViewNewMessages={handleViewNewMessages}
                  onViewAcceptedInvitation={handleViewAcceptedInvitation}
                  onViewStats={handleViewStats}
                  topicStats={topicStats[topic.id]}
                  activeConversation={userConversations[topic.id]}
                  pendingInvitation={pendingInvitations[topic.id]}
                  pendingInvitationsCount={getInvitationCountForTopic(topic.id)}
                  activeConversationsWithNewMessages={activeConversationsWithNewMessages[topic.id] || []}
                  acceptedInvitations={getFilteredAcceptedInvitations(topic.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      
      {/* Add the Topic Detail Dialog */}
      <TopicDetailDialog
        topicId={selectedTopic?.id}
        isOpen={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        onOpenOpinionDialog={(topic) => {
          setShowDetailDialog(false);
          setTimeout(() => {
            handleSelectTopic(topic, 'opinion');
          }, 100);
        }}
        onFindPartners={handleFindPartners}
        userOpinion={selectedTopic ? userOpinions[selectedTopic.id] : null}
        userId={userId}
      />
      
      {/* Add the Stats Dialog */}
      <StatsDialog
        topicId={selectedTopic?.id}
        statType={selectedStatsType}
        isOpen={showStatsDialog}
        onClose={() => setShowStatsDialog(false)}
        onInvite={handleInviteUser}
        userId={userId}
      />
      
      {/* Keep existing dialogs */}
      {/* Add the new messages modal */}
      <NewMessagesModal
        isOpen={showNewMessagesModal}
        onClose={() => setShowNewMessagesModal(false)}
        topic={selectedTopicForMessages}
        conversations={topicNewMessages}
        onSelectConversation={handleSelectConversation}
      />

      {/* Add the invitation preview modal */}
      <InvitationPreviewModal 
        isOpen={showInvitationModal}
        onClose={() => setShowInvitationModal(false)}
        topic={selectedTopicForInvitations}
        invitations={topicInvitations}
        onAccept={handleAcceptInvitation}
      />

      {showDialog && selectedTopic && (
        <TopicDialog
          topic={selectedTopic}
          onClose={handleCloseDialog}
          onSave={(stance, reasoning) => handleSaveOpinion(selectedTopic.id, stance, reasoning)}
          userOpinion={userOpinions[selectedTopic.id]}
        />
      )}

      <PostOpinionDialog
        isOpen={showPostOpinionDialog}
        onClose={() => setShowPostOpinionDialog(false)}
        onFindPartners={handleFindPartnersDialog}
        onExploreTopics={handleExploreTopics}
      />
    </div>
  );
}
