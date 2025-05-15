import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MessageCircle, 
  Users,
  Clock,
  CheckCircle,
  Award
} from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import { TopicOpinion } from "@/api/entities";
import { useLanguage } from '@/components/utils/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Conversations() {
  const [userId, setUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [topics, setTopics] = useState({});
  const [userProfiles, setUserProfiles] = useState({});
  const [activeTab, setActiveTab] = useState("active");
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const navigate = useNavigate();
  const previousStatuses = React.useRef({});
  const { showToast } = useAppToast();
  const { t, direction } = useLanguage();
  
  // Add state for topic filtering
  const [filteredTopicId, setFilteredTopicId] = useState(null);
  const location = useLocation();
  
  const [allTopics, setAllTopics] = useState([]);

  useEffect(() => {
    // Check for topicId in URL parameters
    const urlParams = new URLSearchParams(location.search);
    const topicId = urlParams.get('topicId');
    if (topicId) {
      setFilteredTopicId(topicId);
      setActiveTab("active");
    }
    
    loadData();
    
    // Reduce polling frequency from 30s to 60s
    const interval = setInterval(() => {
      const now = Date.now();
      const lastCheck = parseInt(localStorage.getItem('lastStatusCheck') || '0');
      
      // Only check if it's been at least 60 seconds since last check
      if (now - lastCheck >= 60000) {
        checkForStatusChanges();
        localStorage.setItem('lastStatusCheck', now.toString());
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [location.search]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Check cache first
      const cachedData = localStorage.getItem('conversationsData');
      const cacheTime = parseInt(localStorage.getItem('conversationsDataTime') || '0');
      const now = Date.now();
      
      // Use cache if it's less than 1 minute old
      if (cachedData && now - cacheTime < 60000) {
        const data = JSON.parse(cachedData);
        setConversations(data.conversations);
        setTopics(data.topics);
        setUserProfiles(data.userProfiles);
        setIsLoading(false);
        return;
      }

      const user = await User.me();
      setUserId(user.id);
      
      // Load all topics for filter dropdown in parallel with other data
      loadAllTopics();
      
      // Load conversations with exponential backoff retry
      const allConversations = await retryWithBackoff(() => Conversation.list());
      
      // Initialize previous statuses
      allConversations.forEach(conv => {
        previousStatuses.current[conv.id] = conv.status;
      });
      
      const userConversations = allConversations
        .filter(conv => conv.participant1_id === user.id || conv.participant2_id === user.id)
        .sort((a, b) => {
          if (a.status === "invited" && b.status !== "invited") return -1;
          if (a.status !== "invited" && b.status === "invited") return 1;
          return new Date(b.created_date) - new Date(a.created_date);
        });
      
      setConversations(userConversations);
      
      // Load topics with caching
      const topicIds = [...new Set(userConversations.map(conv => conv.topic_id))];
      const topicsMap = {};
      
      const cachedTopics = JSON.parse(localStorage.getItem('topicsCache') || '{}');
      const topicPromises = topicIds.map(async topicId => {
        if (cachedTopics[topicId]) {
          topicsMap[topicId] = cachedTopics[topicId];
          return;
        }
        
        try {
          const topic = await Topic.get(topicId);
          topicsMap[topicId] = {
            id: topic.id,
            title: topic.title,
            category: topic.category
          };
          cachedTopics[topicId] = topicsMap[topicId];
        } catch (error) {
          console.error(`Error loading topic ${topicId}:`, error);
          topicsMap[topicId] = {
            id: topicId,
            title: t("Topic Unavailable"),
            category: t("Unknown")
          };
        }
      });
      
      await Promise.all(topicPromises);
      localStorage.setItem('topicsCache', JSON.stringify(cachedTopics));
      setTopics(topicsMap);
      
      // Load user profiles - IMPROVED SECTION
      const profilesMap = {};
      
      // Collect all participant IDs from conversations
      const participantIds = new Set();
      userConversations.forEach(conv => {
        participantIds.add(conv.participant1_id);
        participantIds.add(conv.participant2_id);
      });
      
      // Check cached profiles first
      const cachedProfiles = JSON.parse(localStorage.getItem('cachedUserProfiles') || '[]');
      const cachedProfileMap = {};
      cachedProfiles.forEach(profile => {
        if (profile && profile.user_id) {
          cachedProfileMap[profile.user_id] = profile;
        }
      });
      
      // Filter out IDs we already have cached
      const idsToLoad = [...participantIds].filter(id => !cachedProfileMap[id]);
      
      // Add cached profiles to our results
      participantIds.forEach(id => {
        if (cachedProfileMap[id]) {
          profilesMap[id] = cachedProfileMap[id];
        }
      });
      
      // Load profiles in batches to prevent rate limiting
      if (idsToLoad.length > 0) {
        console.log(`Loading ${idsToLoad.length} user profiles`);
        
        // Process in smaller batches
        for (let i = 0; i < idsToLoad.length; i += 3) {
          const batchIds = idsToLoad.slice(i, i + 3);
          const batchPromises = batchIds.map(async id => {
            try {
              const profiles = await UserProfile.filter({ user_id: id });
              if (profiles.length > 0) {
                profilesMap[id] = profiles[0];
                
                // Update cache
                if (!cachedProfileMap[id]) {
                  cachedProfiles.push(profiles[0]);
                }
              } else {
                // Create placeholder for missing profiles
                profilesMap[id] = {
                  user_id: id,
                  display_name: t("Unknown participant"),
                  avatar_color: "#cccccc"
                };
              }
            } catch (error) {
              console.error(`Error loading profile for ${id}:`, error);
            }
          });
          
          await Promise.all(batchPromises);
          
          // Add a small delay between batches
          if (i + 3 < idsToLoad.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Update cached profiles
        localStorage.setItem('cachedUserProfiles', JSON.stringify(cachedProfiles));
      }
      
      setUserProfiles(profilesMap);
      
      // Cache the loaded data
      localStorage.setItem('conversationsData', JSON.stringify({
        conversations: userConversations,
        topics: topicsMap,
        userProfiles: profilesMap
      }));
      localStorage.setItem('conversationsDataTime', now.toString());
      
    } catch (error) {
      console.error("Error loading data:", error);
      showToast(
        t("Error loading conversations"),
        t("Please try again later"),
        "destructive"
      );
      
      // Try to use cached data as fallback
      const cachedData = localStorage.getItem('conversationsData');
      if (cachedData) {
        const data = JSON.parse(cachedData);
        setConversations(data.conversations);
        setTopics(data.topics);
        setUserProfiles(data.userProfiles);
      }
    }
    setIsLoading(false);
  };

  // Add retry utility function
  const retryWithBackoff = async (fn, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limit error - wait with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries reached');
  };

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
        
        // If this is a new conversation or status has changed to "waiting"
        if (prevStatus && prevStatus === "invited" && conv.status === "waiting") {
          // Load other participant's profile
          const loadProfile = async () => {
            try {
              const profiles = await UserProfile.filter({ user_id: conv.participant2_id });
              const otherProfile = profiles[0];
              
              if (otherProfile) {
                showToast(
                  t("Invitation Accepted!"),
                  t("{{name}} accepted your conversation invitation", { name: otherProfile.display_name }),
                  "default",
                  <Button 
                    onClick={() => navigate(`${createPageUrl("ChatView")}?id=${conv.id}`)}
                    size="sm"
                    className="mt-2"
                  >
                    {t("View Conversation")}
                  </Button>
                );
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

  // Load all topics for the filter dropdown
  const loadAllTopics = async () => {
    try {
      const topics = await Topic.list("-created_date", 100);
      setAllTopics(topics);
    } catch (error) {
      console.error("Error loading topics for filter:", error);
    }
  };

  const handleSelectConversation = (conversation) => {
    navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`);
  };

  const getOtherParticipantId = (conversation) => {
    return conversation.participant1_id === userId
      ? conversation.participant2_id
      : conversation.participant1_id;
  };

  const getConversationTitle = (conversation) => {
    const topic = topics[conversation.topic_id];
    return topic ? topic.title : t("Untitled Conversation");
  };

  const getConversationStatusClass = (status) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "abandoned":
        return "bg-gray-100 text-gray-600 border-gray-200";
      case "invited":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "completion_requested":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "waiting_completion":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getConversationStatusIcon = (status) => {
    switch (status) {
      case "waiting":
        return <Clock className="h-4 w-4" />;
      case "active":
        return <MessageCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "invited":
        return <Users className="h-4 w-4" />;
      case "completion_requested":
        return <Clock className="h-4 w-4" />;
      case "waiting_completion":
        return <Clock className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };
  
  // Handle topic filter selection
  const handleTopicFilterChange = (topicId) => {
    if (topicId === "all") {
      // Clear filter
      setFilteredTopicId(null);
      navigate(createPageUrl("Conversations"));
    } else {
      // Apply filter
      setFilteredTopicId(topicId);
      navigate(`${createPageUrl("Conversations")}?topicId=${topicId}`);
    }
  };

  // Filter conversations based on active tab and topic filter
  const filteredConversations = conversations.filter(conv => {
    // Apply topic filter first if present
    if (filteredTopicId && conv.topic_id !== filteredTopicId) {
      return false;
    }
    
    // Then apply tab filter
    switch (activeTab) {
      case "active":
        return conv.status === "active" || conv.status === "waiting" || 
               conv.status === "invited" || conv.status === "waiting_completion" || conv.status === "completion_requested";
      case "completed":
        return conv.status === "completed";
      case "all":
        return true;
      default:
        return true;
    }
  });

  const getUserScore = (conversation) => {
    return conversation.participant1_id === userId
      ? conversation.participant1_score
      : conversation.participant2_score;
  };

  // Fix the function that was causing the error:
  const renderConversationCard = (conversation) => {
    const isParticipant1 = conversation.participant1_id === userId;
    const otherParticipantId = isParticipant1 ? conversation.participant2_id : conversation.participant1_id;
    const otherParticipant = userProfiles[otherParticipantId];
    const topic = topics[conversation.topic_id];
    
    return (
      <div 
        key={conversation.id} 
        onClick={() => handleSelectConversation(conversation)}
        className="cursor-pointer"
      >
        <ConversationCard 
          conversation={conversation} 
          topic={topic} 
          otherParticipant={otherParticipant} 
          userId={userId} 
          t={t}
          direction={direction}
          getConversationTitle={getConversationTitle}
          getConversationStatusClass={getConversationStatusClass}
          getConversationStatusIcon={getConversationStatusIcon}
          getUserScore={getUserScore}
          navigate={navigate}
          createPageUrl={createPageUrl}
        />
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
      <header className={`flex flex-col md:flex-row justify-between items-center gap-4`}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {filteredTopicId && topics[filteredTopicId] ? 
              t("Conversations: {{topic}}", { topic: topics[filteredTopicId].title }) : 
              t("Conversations")}
          </h1>
          <p className="text-gray-600 mt-1">
            {filteredTopicId ?
              t("Your active conversations about this specific topic") :
              t("Chat with others about topics and learn to recognize cognitive biases")}
          </p>
        </div>

        <div className={`flex flex-col sm:flex-row gap-3 ${direction === 'rtl' ? 'sm:flex-row-reverse' : ''}`}>
          <Select
            value={filteredTopicId || "all"}
            onValueChange={handleTopicFilterChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("Filter by topic")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Topics")}</SelectItem>
              {allTopics.map(topic => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={() => navigate(createPageUrl("FindPartners"))}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Users className={`h-5 w-5 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t("Find Discussion Partners")}
          </Button>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`flex border-b border-gray-200 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <TabsTrigger 
              value="active" 
              className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === 'active' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t("Active")}
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === 'completed' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t("Completed")}
            </TabsTrigger>
            <TabsTrigger 
              value="all" 
              className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === 'all' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t("All")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* List of conversations */}
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className={`h-5 bg-gray-200 rounded w-3/4 mb-2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
                      <div className={`h-4 bg-gray-200 rounded w-1/2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
                      <div className="h-10 mt-2 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-1">{t("No active conversations")}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {t("Start a meaningful discussion with someone who has a different perspective")}
                  </p>
                  <Button
                    onClick={() => navigate(createPageUrl("FindPartners"))}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Users className={`h-5 w-5 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t("Find Discussion Partners")}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {filteredConversations.map(conversation => (
                    renderConversationCard(conversation)
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* List of conversations */}
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className={`h-5 bg-gray-200 rounded w-3/4 mb-2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
                      <div className={`h-4 bg-gray-200 rounded w-1/2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
                      <div className="h-10 mt-2 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-1">{t("No completed conversations yet")}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {t("Have meaningful discussions to see your conversation history here")}
                  </p>
                  <Button
                    onClick={() => navigate(createPageUrl("FindPartners"))}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Users className={`h-5 w-5 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t("Find Discussion Partners")}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {filteredConversations.map(conversation => (
                    renderConversationCard(conversation)
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="all">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* List of conversations */}
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className={`h-5 bg-gray-200 rounded w-3/4 mb-2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
                      <div className={`h-4 bg-gray-200 rounded w-1/2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
                      <div className="h-10 mt-2 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-1">{t("No conversations yet")}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {t("Start your first meaningful discussion with someone new")}
                  </p>
                  <Button
                    onClick={() => navigate(createPageUrl("FindPartners"))}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Users className={`h-5 w-5 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t("Find Discussion Partners")}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {filteredConversations.map(conversation => (
                    renderConversationCard(conversation)
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ConversationCard({ 
  conversation, 
  topic, 
  otherParticipant, 
  userId, 
  t, 
  direction, 
  getConversationTitle,
  getConversationStatusClass,
  getConversationStatusIcon,
  getUserScore,
  navigate,
  createPageUrl
}) {
  // Add timer information display
  const hasTimer = conversation.expires_at != null;
  let timeRemaining = null;
  let isExpiringSoon = false;
  
  if (hasTimer) {
    const now = new Date();
    const expiry = new Date(conversation.expires_at);
    timeRemaining = expiry - now;
    isExpiringSoon = timeRemaining > 0 && timeRemaining < 60 * 60 * 1000; // Less than 1 hour
  }
  
  const formatTimeRemaining = (ms) => {
    if (ms <= 0) return t("Expired");
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return t("{{days}}d {{hours}}h remaining", { days, hours: hours % 24 });
    } else if (hours > 0) {
      return t("{{hours}}h {{minutes}}m remaining", { hours, minutes: minutes % 60 });
    } else {
      return t("{{minutes}}m remaining", { minutes });
    }
  };

  return (
    <Card className={`bg-white hover:shadow-md transition-all duration-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
      <CardContent className="p-4">
        <div className={`flex justify-between items-start mb-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-medium text-gray-900 line-clamp-1 mr-2">
            {getConversationTitle(conversation)}
          </h3>
          <Badge
            className={`flex-shrink-0 flex items-center gap-1 ml-2 border ${getConversationStatusClass(conversation.status)} ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}
          >
            {getConversationStatusIcon(conversation.status)}
            <span className="capitalize">
              {t(conversation.status)}
            </span>
          </Badge>
        </div>
        
        <div className={`flex items-center mb-1 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          {otherParticipant ? (
            <>
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}
                style={{ backgroundColor: otherParticipant.avatar_color || '#6366f1' }}
              >
                {otherParticipant.display_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="text-sm text-gray-600">{otherParticipant.display_name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">{t("Unknown participant")}</span>
          )}
          
          {conversation.started_at && (
            <span className={`text-xs text-gray-500 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}>
              {new Date(conversation.started_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Add timer indicator */}
        {hasTimer && timeRemaining > 0 && (
          <div className={`mt-2 flex items-center gap-2 px-2 py-1 rounded-md text-xs ${
            isExpiringSoon ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          } ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Clock className="h-3 w-3" />
            <span>{formatTimeRemaining(timeRemaining)}</span>
          </div>
        )}
        
        {conversation.auto_completed && (
          <div className={`mt-2 flex items-center gap-2 px-2 py-1 rounded-md text-xs bg-gray-50 text-gray-700 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Clock className="h-3 w-3" />
            <span>{t("Auto-completed by timer")}</span>
          </div>
        )}
        
        {getUserScore(conversation) && (
          <div className={`mt-2 flex items-center text-sm ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Award className={`h-4 w-4 text-indigo-500 ${direction === 'rtl' ? 'ml-1' : 'mr-1'}`} />
            <div dir={direction} className="flex items-center">
              <span className="text-gray-700">{t("Score")}: </span>
              <Badge variant="outline" className={`${direction === 'rtl' ? 'mr-1' : 'ml-1'} font-medium`}>
                <div dir={direction} className="flex items-center">
                  <span>{getUserScore(conversation).total || 0}</span>
                  <span className={direction === 'rtl' ? 'mr-1' : 'ml-1'}>{t("pts")}</span>
                </div>
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}