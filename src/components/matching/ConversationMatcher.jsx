
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  RefreshCw, 
  Sparkles,
  Brain,
  Shield,
  Clock,
  Filter,
  Loader2,
  Scale,
  Check,
  AlignHorizontalDistributeCenter,
  UserRoundSearch
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppToast } from "@/components/utils/toast";
import { delay, retryWithBackoff } from "../utils/apiHelpers";
import Avatar from "@/components/ui/avatar";
import TimerSelector from "../conversations/TimerSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';
import { sendPushNotification } from "@/components/utils/apiHelpers";

export default function ConversationMatcher({ onMatchFound, preSelectedTopicId }) {
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userOpinions, setUserOpinions] = useState([]);
  const [allOpinions, setAllOpinions] = useState([]);
  const [allTopics, setAllTopics] = useState({});
  const [allUserProfiles, setAllUserProfiles] = useState({});
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [matchType, setMatchType] = useState("all");
  // Replace topicFilter with tagFilter
  const [tagFilter, setTagFilter] = useState("all");
  const [blockedTopicPartners, setBlockedTopicPartners] = useState(new Set());
  const [rawUserData, setRawUserData] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [invitations, setInvitations] = useState([]);
  const [matchPreferences, setMatchPreferences] = useState({
    matchType: "all",
    topicFocus: "all"
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const [invitationStatus, setInvitationStatus] = useState(null);
  const [sendingInvitation, setSendingInvitation] = useState(false);
  // Update timer state with default 2 days
  const [timerDuration, setTimerDuration] = useState(2);
  const [timerUnit, setTimerUnit] = useState("days");
  const [isInviting, setIsInviting] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState(null);
  const [allUniqueTopicTags, setAllUniqueTopicTags] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const { t, direction } = useLanguage();

  // Add new state for expanded reasoning
  const [expandedReasonings, setExpandedReasonings] = useState(new Set());

  const toggleReasoning = (matchId) => {
    setExpandedReasonings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    loadInvitations(userId);
  }, [userId]);

  // Add a new useEffect to filter matches when match type or topic filter changes
  useEffect(() => {
    // Only run this effect if we have already loaded the raw data
    if (initialLoadComplete && rawUserData) {
      console.log(`[ConversationMatcher] Filtering matches with type "${matchType}" and tag "${tagFilter}"`);
      filterMatches();
    }
  }, [matchType, tagFilter, initialLoadComplete, rawUserData]);

  // Function to calculate stance difference
  const calculateStanceDifference = (stance1, stance2) => {
    // Map string stances to numeric values
    const stanceValues = {
      "strongly_agree": 5,
      "agree": 4,
      "neutral": 3,
      "disagree": 2,
      "strongly_disagree": 1
    };
  
    // Get numeric values, default to neutral (3) if stance is invalid
    const value1 = stanceValues[stance1] || 3;
    const value2 = stanceValues[stance2] || 3;
  
    // Return absolute difference
    return Math.abs(value1 - value2);
  };

  // Initial data loading function
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Get current user
      const user = await User.me();
      setUserId(user.id);
      
      // Get user's opinions and all other data
      const [myOpinions, allOpinionsList, allTopicsList, allProfilesList] = await Promise.all([
        TopicOpinion.filter({ user_id: user.id, willing_to_discuss: true }, "-created_date", 3),
        TopicOpinion.list(),
        Topic.list(),
        UserProfile.list()
      ]);
      
      // Store raw data for filtering
      setRawUserData({
        myOpinions,
        allOpinions: allOpinionsList.filter(op => op.user_id !== user.id), // exclude user's own opinions
        userId: user.id
      });
      
      // Store user opinions
      setUserOpinions(myOpinions);
      
      // Convert topics and profiles to map for faster lookup
      const topicsMap = {};
      const uniqueTags = new Set();
      allTopicsList.forEach(topic => {
        topicsMap[topic.id] = topic;
        if (topic.tags) {
          topic.tags.forEach(tag => uniqueTags.add(tag));
        }
      });
      setAllTopics(topicsMap);
      setAllUniqueTopicTags(Array.from(uniqueTags));
      
      const profilesMap = {};
      allProfilesList.forEach(profile => {
        profilesMap[profile.user_id] = profile;
      });
      
      setAllUserProfiles(profilesMap);

      // Load blocked topic partners
      await loadBlockedTopicPartners(user.id);
      
      // With all data loaded, perform initial filtering
      setInitialLoadComplete(true);
      
    } catch (error) {
      console.error("Error loading initial data:", error);
      showToast(
        t("Error finding matches"),
        t("Please try again later"),
        "destructive"
      );
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  };
  
  const loadBlockedTopicPartners = async (userId) => {
    try {
      // Load both user's conversations and invitations
      console.log("[ConversationMatcher] Loading blocked topic partners for user:", userId);
      
      // Get all conversations where this user is participant1 or participant2
      const existingConversations = await Conversation.filter({
        $or: [
          { participant1_id: userId },
          { participant2_id: userId }
        ]
      });
      
      // Get all pending invitations separately (as they might be cached differently)
      const pendingInvitations = await Conversation.filter({
        participant2_id: userId,
        status: "invited"
      });
      
      console.log("[ConversationMatcher] Found existing conversations:", existingConversations.length);
      console.log("[ConversationMatcher] Found pending invitations:", pendingInvitations.length);
      
      // Combine both lists
      const allRelevantConversations = [...existingConversations, ...pendingInvitations];
      
      // Create a map of topic-partner combinations to block
      const blockedTopicPartnersSet = new Set();
      
      allRelevantConversations.forEach(conv => {
        if (conv.status === "active" || conv.status === "waiting" || conv.status === "invited") {
          const partnerId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
          const key = `${conv.topic_id}-${partnerId}`;
          blockedTopicPartnersSet.add(key);
          console.log("[ConversationMatcher] Blocking combination:", {
            key,
            topicId: conv.topic_id,
            partnerId,
            status: conv.status,
            youAreParticipant: conv.participant1_id === userId ? "1" : "2"
          });
        }
      });
  
      setBlockedTopicPartners(blockedTopicPartnersSet);
    } catch (error) {
      console.error("Error loading blocked topic partners:", error);
    }
  };

  // New function to filter matches without fetching data again
  const filterMatches = () => {
    if (!rawUserData) return;
    
    const { myOpinions, allOpinions, userId } = rawUserData;
    const matches = [];
    
    for (const userOpinion of myOpinions) {
      // Find opinions on the same topic from other users
      const topicOpinions = allOpinions.filter(op => op.topic_id === userOpinion.topic_id);
      
      for (const opinion of topicOpinions) {
        try {
          // Check if this topic-partner combination is blocked
          const key = `${userOpinion.topic_id}-${opinion.user_id}`;
          if (blockedTopicPartners.has(key)) {
            continue;
          }

          // Calculate stance difference
          const stanceDiff = calculateStanceDifference(userOpinion.stance, opinion.stance);
          
          // Filter based on match type - now includes "all" option
          if (matchType === "opposite" && stanceDiff < 3) {
            continue; // Skip if not opposite enough (needs 3-4 points difference)
          } else if (matchType === "similar" && stanceDiff > 1) {
            continue; // Skip if not similar enough (needs 0-1 point difference)
          } else if (matchType === "moderate" && stanceDiff !== 2) {
            continue; // Skip if not a moderate difference (needs exactly 2 points)
          }
          // For "all", we don't skip any matches based on stance difference
          
          // Get topic and profile from our cached data
          const topic = allTopics[userOpinion.topic_id];
          const profile = allUserProfiles[opinion.user_id];
          
          if (!topic || !profile) continue;
          
          // Filter by tag instead of category
          let isMatch = false;
          if (tagFilter === "all") {
            isMatch = true;
          } else if (topic.tags && topic.tags.includes(tagFilter)) {
            isMatch = true; // Tag match
          }

          if (!isMatch) continue;

          // Add match to potential matches
          matches.push({
            topicId: userOpinion.topic_id,
            topicTitle: topic.title,
            topicTags: topic.tags || [],
            matchUserId: opinion.user_id,
            matchUserProfile: profile,
            matchStance: opinion.stance,
            myStance: userOpinion.stance,
            stanceDifference: stanceDiff,
            reasoning: opinion.reasoning
          });
        } catch (error) {
          console.error("Error processing match:", error);
        }
      }
    }
    
    console.log(`[ConversationMatcher] Filtered to ${matches.length} matches with matchType "${matchType}" and tag "${tagFilter}"`);
    setPotentialMatches(matches);
  };

  // Also update loadInvitations to sync with match filtering
  const loadInvitations = async (uid) => {
    if (!uid) return;
    
    try {
      // Get only recent invitations, with retry
      console.log("[ConversationMatcher] Loading invitations for user:", uid);
      const invitedConversations = await retryWithBackoff(() => 
        Conversation.filter({ 
          participant2_id: uid,
          status: "invited"
        }, "-created_date", 3) // Limit to 3 most recent
      ); 
      
      console.log("[ConversationMatcher] Found invitations:", invitedConversations.length);
      
      // Only process the first invitation to avoid rate limits
      const invites = [];
      if (invitedConversations.length > 0) {
        try {
          await delay(300);
          const [topic, senderProfiles] = await Promise.all([
            retryWithBackoff(() => Topic.get(invitedConversations[0].topic_id)),
            retryWithBackoff(() => UserProfile.filter({ user_id: invitedConversations[0].participant1_id }))
          ]);
          
          invites.push({
            conversation: invitedConversations[0],
            topic,
            sender: senderProfiles[0] || null
          });
        } catch (error) {
          console.warn("Error loading invitation details:", error);
        }
      }
      
      // After loading invitations, also adjust potential matches
      const currentMatches = [...potentialMatches];
      
      // Filter out any matches that conflict with new invitations
      const filteredMatches = currentMatches.filter(match => {
        return !invitedConversations.some(inv => 
          inv.topic_id === match.topicId && 
          (inv.participant1_id === match.matchUserId || inv.participant2_id === match.matchUserId)
        );
      });
      
      // If we filtered any matches, update state
      if (filteredMatches.length !== currentMatches.length) {
        console.log("[ConversationMatcher] Updating matches after loading invitations");
        setPotentialMatches(filteredMatches);
      }
      
      setInvitations(invites);
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  };

  const handleSendInvitation = async (match) => {
    setSendingInvitation(true);
    
    try {
      // Calculate duration in minutes for storage
      let durationInMinutes = timerDuration;
      
      if (timerUnit === "hours") {
        durationInMinutes = timerDuration * 60;
      } else if (timerUnit === "days") {
        durationInMinutes = timerDuration * 60 * 24;
      }
      
      // Create conversation with timer_duration but NOT expires_at yet
      // expires_at will be set when the first message is sent
      const conversation = await Conversation.create({
        topic_id: match.topicId,
        participant1_id: userId,
        participant2_id: match.matchUserId,
        status: "invited",
        timer_duration: durationInMinutes
      });
      
      if (conversation) {
        showToast(
          t("Invitation sent"),
          t("Invitation sent to {{name}}", { name: match.matchUserProfile.display_name })
        );
        
        if (onMatchFound) {
          onMatchFound(conversation);
        }
        
        // Block this combination to prevent duplicate invitations
        setBlockedTopicPartners(prev => {
          const newBlocked = new Set(prev);
          newBlocked.add(`${match.topicId}-${match.matchUserId}`);
          return newBlocked;
        });
        
        // Reload matches
        filterMatches();
        
        // --- Send Push Notification for New Invitation ---
        const inviterProfile = allUserProfiles[userId];
        const inviteeId = match.matchUserId;

        if (inviteeId && inviterProfile.user_id !== inviteeId) {
          console.log(`Attempting to send NEW_INVITATION push to ${inviteeId}`);
          sendPushNotification({ // No need to await
            userId: inviteeId,
            type: "NEW_INVITATION",
            title: "New Discussion Invitation",
            body: `${inviterProfile?.display_name || 'Someone'} invited you to discuss "${allTopics[match.topicId]?.title || 'a topic'}"`,
            data: {
              conversationId: conversation.id,
              inviterId: inviterProfile.user_id,
              topicId: match.topicId
            }
          });
        }
        // --- End Send Push Notification ---
        
        // Navigate to conversation on match
        const navigateToChatView = async () => {
          setTimeout(() => {
            navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`);
          }, 500); // Small delay for toast visibility
        };
        
        navigateToChatView();
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      showToast(
        t("Error sending invitation"),
        t("Please try again later"),
        "destructive"
      );
    }
    
    setSendingInvitation(false);
  };

  const getStanceLabel = (stance) => {
    // Handle both numeric and string formats
    if (typeof stance === 'string') {
      switch (stance) {
        case "strongly_agree": return t("Strongly Agree");
        case "agree": return t("Agree");
        case "neutral": return t("Neutral");
        case "disagree": return t("Disagree");
        case "strongly_disagree": return t("Strongly Disagree");
        default: return t("Unknown");
      }
    } else if (typeof stance === 'number') {
      // Keep backward compatibility with numeric values
      switch (stance) {
        case 5: return t("Strongly Agree");
        case 4: return t("Agree");
        case 3: return t("Neutral");
        case 2: return t("Disagree");
        case 1: return t("Strongly Disagree");
        default: return t("Unknown");
      }
    }
    return t("Unknown");
  };

  const getMatchTypeIcon = (type) => {
    switch (type) {
      case "balanced":
        return <Brain className="h-4 w-4 text-indigo-600" />;
      case "challenging":
        return <Sparkles className="h-4 w-4 text-orange-600" />;
      case "similar":
        return <Shield className="h-4 w-4 text-green-600" />;
      case "all":
        return <Users className="h-4 w-4 text-gray-600" />;
      default:
        return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  // Update the match type change handler
  const handleMatchTypeChange = (value) => {
    console.log(`[ConversationMatcher] Setting match type to "${value}"`);
    setMatchType(value);
  };

  // Update the topic filter change handler
  const handleTagFilterChange = (value) => {
    console.log(`[ConversationMatcher] Setting tag filter to "${value}"`);
    setTagFilter(value);
  };

  // Update the refresh function
  const refreshMatches = () => {
    loadInitialData();
    setRefreshTrigger(prev => prev + 1); // Force a re-render
  };

  // Call loadInitialData on component mount
  useEffect(() => {
    loadInitialData();
  }, []);

    // Add effect to handle pre-selected topic
    useEffect(() => {
      if (preSelectedTopicId && !selectedTopic) {
        const loadPreselectedTopic = async () => {
          try {
            const topic = await Topic.get(preSelectedTopicId);
            setSelectedTopic(topic);
          } catch (error) {
            console.error("Error loading pre-selected topic:", error);
          }
        };
        
        loadPreselectedTopic();
      }
    }, [preSelectedTopicId]);

  return (
    <Card dir={direction} className="bg-white shadow-sm border-0 overflow-hidden w-full">
      <CardHeader className="border-b bg-gray-50">
        <div className={`flex justify-between items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
            <CardTitle className="text-lg">{t("Find Discussion Partners")}</CardTitle>
            <CardDescription>
              {t("Match with others who share your interests")}
            </CardDescription>
          </div>
          <Button size="sm" onClick={refreshMatches} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t("Refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        
        <div className="mb-4">
          <label className={`text-sm font-medium text-gray-700 mb-2 block ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
            {t("Find users by")}:
          </label>
          <div className={`flex gap-3 flex-wrap ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <div>
              <label className={`text-xs font-medium text-gray-700 mb-1 block ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                {t("Match Type")}
              </label>
              <Select
                value={matchType}
                onValueChange={handleMatchTypeChange}
              >
                <SelectTrigger className="h-8 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{t("All Views")}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="opposite">
                    <div className="flex items-center gap-2">
                      <UserRoundSearch className="h-4 w-4" />
                      <span>{t("Opposite Views")}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="moderate">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      <span>{t("Moderate Differences")}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="similar">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      <span>{t("Similar Views")}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={`text-xs font-medium text-gray-700 mb-1 block ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                {t("Filter by Tag")}
              </label>
              <Select
                value={tagFilter}
                onValueChange={handleTagFilterChange}
              >
                <SelectTrigger className="h-8 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All Tags")}</SelectItem>
                  
                  {/* List all unique tags */}
                  {allUniqueTopicTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>  
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Match explanation - with more detailed debug information */}
        <div className={`bg-gray-50 rounded-lg p-2 mb-3 text-xs ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center gap-2 text-gray-700 mb-1 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            {matchType === "all" && <Users className="h-4 w-4 text-gray-500" />}
            {matchType === "opposite" && <UserRoundSearch className="h-4 w-4 text-blue-500" />}
            {matchType === "moderate" && <Scale className="h-4 w-4 text-amber-500" />}
            {matchType === "similar" && <Check className="h-4 w-4 text-green-500" />}
          
            <span className="font-medium">
              {matchType === "all" && t("Finding all potential discussion partners")}
              {matchType === "opposite" && t("Finding partners with opposing views")}
              {matchType === "moderate" && t("Finding partners with moderate differences")}
              {matchType === "similar" && t("Finding partners with similar views")}
            </span>
          </div>
          <p className="text-gray-600 text-xs">
            {matchType === "all" && t("See all available discussion partners regardless of their stance")}
            {matchType === "opposite" && t("Perfect for challenging your views and having deep debates")}
            {matchType === "moderate" && t("Great for balanced discussions and understanding different perspectives")}
            {matchType === "similar" && t("Ideal for refining your arguments and finding common ground")}
          </p>
          
          {/* Add tag filter info if a tag is selected */}
          {tagFilter !== "all" && (
            <div className={`mt-1 flex items-center gap-1 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <Badge className="bg-indigo-100 text-indigo-800">
                {tagFilter}
              </Badge>
              <span className="text-xs text-gray-600">{t("Selected tag filter")}</span>
            </div>
          )}
        </div>

        {/* Invitation status display */}
        {invitationStatus && (
          <div className={`bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
            <div className={`flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
              <div>
                <h3 className="font-medium text-indigo-900">
                  {t("Waiting for response")}
                </h3>
                <p className="text-sm text-indigo-700">
                  {t("Invitation sent to")} {invitationStatus.participantName}. {t("We'll notify you when they respond.")}
                </p>
              </div>
            </div>
            <div className={`mt-3 text-xs text-indigo-600 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
              {t("Sent")} {new Date(invitationStatus.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}
        
        {/* Add timer selector */}
        <div className={`mb-4 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
          <div className="mb-2 text-sm font-medium text-gray-700">
            {t("Conversation Timer")}
          </div>
          <div className="text-xs text-gray-500 mb-2">
            {t("Set how long this conversation will last. After the timer expires, the conversation will automatically complete.")}
          </div>
          <TimerSelector 
            duration={timerDuration}
            unit={timerUnit}
            onDurationChange={setTimerDuration}
            onUnitChange={setTimerUnit}
          />
        </div>

        {/* Matches list with proper height - modified for better mobile view */}
        <div className={`space-y-3 max-h-[50vh] overflow-y-auto pb-2 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
          {isLoading ? (
            <>
              <MatchCardSkeleton />
              <MatchCardSkeleton />
            </>
          ) : potentialMatches.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-600 mb-1">{t("No matches found")}</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                {t("Try changing your match preferences or share your opinion on more topics")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(createPageUrl("Topics"))}
              >
                {t("Explore Topics")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {potentialMatches.map((match, index) => (
                <div key={`${match.topicId}-${match.matchUserId}`} className="p-4 border-b last:border-b-0">
                  {/* Make match cards more responsive */}
                  <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${direction === 'rtl' ? 'sm:flex-row-reverse' : ''}`}>
                    <Avatar
                      user={match.matchUserProfile}
                      size="lg"
                      className="ring-2 ring-white mx-auto sm:mx-0"
                    />
                    <div className="flex-1 min-w-0">
                      {/* User info */}
                      <div className={`flex items-center justify-between mb-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <div className="text-center sm:text-left">
                          <div className="font-medium">
                            {match.matchUserProfile.display_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {t("Level")} {match.matchUserProfile.level || 1}
                          </div>
                        </div>
                        <Badge className={`bg-indigo-100 text-indigo-800 flex items-center gap-1 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                          <Brain className="h-3 w-3" />
                          <span>
                            {match.stanceDifference || 0} {match.stanceDifference !== 1 ? t('points') : t('point')} {t('diff')}
                          </span>
                        </Badge>
                      </div>

                      {/* Topic */}
                      <div className={`mb-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {t("Topic")}:
                        </div>
                        <div className="font-medium">{match.topicTitle}</div>
                      </div>

                      {/* Stances */}
                      <div className={`grid grid-cols-2 gap-2 mb-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <div className="bg-gray-50 p-2 rounded-md">
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            {t("Your stance")}:
                          </div>
                          <div className="font-medium text-sm">
                            {getStanceLabel(match.myStance)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-md">
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            {t("Their stance")}:
                          </div>
                          <div className="font-medium text-sm">
                            {getStanceLabel(match.matchStance)}
                          </div>
                        </div>
                      </div>

                      {/* Updated reasoning section with more prominent expand/collapse */}
                      <div className={`mt-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <div className={`flex items-start gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                          <MessageSquare className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-sm text-gray-600 font-medium mb-1">{t("Their reasoning")}:</div>
                            <div className="text-sm text-gray-700">
                              {match.reasoning ? (
                                <div className="space-y-2">
                                  <div className={expandedReasonings.has(index) ? "" : "line-clamp-3 relative"}>
                                    {match.reasoning}
                                    {!expandedReasonings.has(index) && match.reasoning.length > 80 && (
                                      <div className={`absolute bottom-0 right-0 w-full h-6 bg-gradient-to-t from-white to-transparent ${direction === 'rtl' ? 'text-right' : 'text-left'}`} />
                                    )}
                                  </div>
                                  {match.reasoning.length > 80 && (
                                    <button
                                      onClick={() => toggleReasoning(index)}
                                      className={`w-full text-center py-1 px-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-1 hover:bg-indigo-50 rounded-md transition-colors ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}
                                    >
                                      {expandedReasonings.has(index) ? (
                                        <>
                                          <ChevronUp className="h-4 w-4" />
                                          {t("Show less")}
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-4 w-4" />
                                          {t("Read more")}
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">{t("No reasoning provided")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700 mt-4"
                        onClick={() => handleSendInvitation(match)}
                        disabled={sendingInvitation}
                      >
                        {sendingInvitation ? t("Sending...") : t("Start Discussion")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500 mt-3 text-center">
          {t("Last refreshed")}: {lastRefresh.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
  
  // Add MatchCardSkeleton inner component
  function MatchCardSkeleton() {
    return (
      <div className="animate-pulse bg-white rounded-lg p-4 border mb-4">
        <div className={`flex items-center gap-3 mb-4 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }
}
