
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAppToast } from "@/components/utils/toast";
import Avatar from "@/components/ui/avatar";
import TimerSelector from "@/components/conversations/TimerSelector";
import { useLanguage } from '@/components/utils/i18n';
import {
  MessageCircle,
  Clock,
  ChevronLeft,
  Loader2,
  ArrowRight,
  RefreshCw,
  UserRoundSearch,
  Users,
  Sparkles,
  Heart,
  Scale,
} from "lucide-react";
import { sendPushNotification } from "@/components/utils/apiHelpers"; // Added import

export default function MatchFinderWizard({ onMatchFound, preSelectedTopicId, selectedTopic }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showToast } = useAppToast();

  // State variables
  const [currentStep, setCurrentStep] = useState(1);
  const [userTopics, setUserTopics] = useState([]);
  const [allTopics, setAllTopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState(preSelectedTopicId || null);
  const [matchType, setMatchType] = useState("all");
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [timerDuration, setTimerDuration] = useState(24);
  const [timerUnit, setTimerUnit] = useState("hours");
  const [isMatchSending, setIsMatchSending] = useState(false);
  const [allUserProfiles, setAllUserProfiles] = useState({});
  const [expandedReasonings, setExpandedReasonings] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [isSendingInvitation, setIsSendingInvitation] = useState({});
  const [sentInvitations, setSentInvitations] = useState([]);
  const [selectedTimerDuration, setSelectedTimerDuration] = useState(60);

  // Load data on component mount
  useEffect(() => {
    loadTopics();
  }, []);

  // Handle preselected topic
  useEffect(() => {
    if (preSelectedTopicId) {
      setSelectedTopicId(preSelectedTopicId);
      // If we have a preselected topic and topics are loaded, advance to step 2
      if (userTopics.length > 0 && userTopics.some(topic => topic.id === preSelectedTopicId)) {
        setCurrentStep(2);
        findMatches(preSelectedTopicId);
      }
    }
  }, [preSelectedTopicId, userTopics]);
  
  // Load topics that the user has opinions on
  const loadTopics = async () => {
    setIsLoading(true);
    setIsInitialLoad(true);
    
    try {
      const user = await User.me();
      const opinions = await TopicOpinion.filter({ user_id: user.id });
      const topics = await Topic.list();
      setAllTopics(topics);
      
      // Join topics with user opinions
      const topicsWithOpinions = opinions.map(opinion => {
        const topic = topics.find(t => t.id === opinion.topic_id);
        return {
          ...topic,
          opinion
        };
      }).filter(t => t.id); // Filter out any undefined topics
      
      setUserTopics(topicsWithOpinions);
      
      // If we have a preselected topic, make sure it matches with user opinions
      if (preSelectedTopicId && topicsWithOpinions.some(t => t.id === preSelectedTopicId)) {
        findMatches(preSelectedTopicId);
      }
    } catch (error) {
      console.error("Error loading topics:", error);
      showToast(
        "Error loading topics",
        "Please try again later",
        "destructive"
      );
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }

    const fetchCurrentUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        if (user?.id) {
          const profiles = await UserProfile.filter({ user_id: user.id });
          if (profiles.length > 0) {
            setCurrentUserProfile(profiles[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching current user in MatchFinderWizard:", error);
      }
    };
    fetchCurrentUser();
  };
  
  const handleTopicSelect = (topicId) => {
    setSelectedTopicId(topicId);
  };
  
  const isTopicSelected = (topicId) => {
    return topicId === selectedTopicId;
  };
  
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedTopicId) {
        showToast(
          "Please select a topic",
          "You need to select a topic before continuing",
          "destructive"
        );
        return;
      }
      
      setCurrentStep(2);
      findMatches(selectedTopicId);
      return;
    }
    
    setCurrentStep(currentStep + 1);
  };
  
  // Find potential matches for discussion
  const findMatches = async (topicId) => {
    setIsLoading(true);
    
    try {
      const user = await User.me();
      const selectedTopic = userTopics.find(t => t.id === topicId);
      
      if (!selectedTopic) {
        showToast(
          "Topic not found",
          "Please select another topic",
          "destructive"
        );
        setIsLoading(false);
        return;
      }
      
      // Find users who have opinions on this topic
      const allOpinions = await TopicOpinion.filter({ topic_id: topicId });
      
      // Filter out the current user
      const otherOpinions = allOpinions.filter(o => o.user_id !== user.id);
      
      // Get all user profiles for the opinions
      const userIds = otherOpinions.map(o => o.user_id);
      const userProfiles = await UserProfile.list();
      
      // Create a map of user profiles by ID
      const userProfileMap = {};
      userProfiles.forEach(profile => {
        userProfileMap[profile.user_id] = profile;
      });
      setAllUserProfiles(userProfileMap);
      
      // Create matches array
      const potentialMatches = otherOpinions.map(opinion => ({
        matchUserId: opinion.user_id,
        matchUserProfile: userProfileMap[opinion.user_id],
        topicId: topicId,
        myStance: selectedTopic.opinion.stance,
        matchStance: opinion.stance,
        reasoning: opinion.reasoning,
        willingToDiscuss: opinion.willing_to_discuss
      }));
      
      // Filter out users not willing to discuss
      const availableMatches = potentialMatches.filter(m => m.willingToDiscuss);
      
      setMatches(availableMatches);
      setFilteredMatches(availableMatches);
      setLastRefreshTime(new Date());
      
      // Apply match type filter
      applyMatchTypeFilter(matchType, availableMatches);
    } catch (error) {
      console.error("Error finding matches:", error);
      showToast(
        "Error finding matches",
        "Please try again later",
        "destructive"
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle match type change and filter results
  const handleMatchTypeChange = (type) => {
    setMatchType(type);
    applyMatchTypeFilter(type, matches);
  };
  
  // Apply match type filter to results
  const applyMatchTypeFilter = (type, matchesArray) => {
    if (!matchesArray || matchesArray.length === 0) {
      setFilteredMatches([]);
      return;
    }
    
    const userStances = ['strongly_disagree', 'disagree', 'neutral', 'agree', 'strongly_agree'];
    
    let filtered;
    
    switch (type) {
      case 'opposite': {
        // Find matches with exactly opposite views
        filtered = matchesArray.filter(match => {
          const userStanceIndex = userStances.indexOf(match.myStance);
          const matchStanceIndex = userStances.indexOf(match.matchStance);
          const difference = Math.abs(userStanceIndex - matchStanceIndex);
          return difference >= 3; // Max difference for completely opposite
        });
        break;
      }
      case 'moderate': {
        // Find matches with moderately different views
        filtered = matchesArray.filter(match => {
          const userStanceIndex = userStances.indexOf(match.myStance);
          const matchStanceIndex = userStances.indexOf(match.matchStance);
          const difference = Math.abs(userStanceIndex - matchStanceIndex);
          return difference >= 1 && difference <= 2; // Moderate difference
        });
        break;
      }
      case 'similar': {
        // Find matches with similar views
        filtered = matchesArray.filter(match => {
          const userStanceIndex = userStances.indexOf(match.myStance);
          const matchStanceIndex = userStances.indexOf(match.matchStance);
          const difference = Math.abs(userStanceIndex - matchStanceIndex);
          return difference === 0; // Same stance
        });
        break;
      }
      default:
        // All stances
        filtered = matchesArray;
    }
    
    setFilteredMatches(filtered);
  };
  
  // Handle refreshing the matches
  const handleRefreshMatches = () => {
    if (selectedTopicId) {
      findMatches(selectedTopicId);
    }
  };
  
  // Format the last refresh time
  const formatLastRefresh = () => {
    if (!lastRefreshTime) return '';
    
    const now = new Date();
    const diff = now - lastRefreshTime;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) {
      return t('Just now');
    } else if (minutes === 1) {
      return t('1 minute ago');
    } else {
      return t('{{minutes}} minutes ago', { minutes });
    }
  };
  
  // Toggle expanded reasoning
  const toggleReasoning = (userId) => {
    setExpandedReasonings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };
  
  // Handle starting a discussion with a match
  const handleMatchSelect = (match) => {
    setSelectedMatch(match);
    setCurrentStep(3);
  };
  
  // Handle sending invitation
  const handleSendInvitation = async () => {
    if (!selectedMatch || !selectedTopicId) {
      showToast(
        "Missing information",
        "Please select a topic and discussion partner",
        "destructive"
      );
      return;
    }
    
    setIsMatchSending(true);
    
    try {
      const user = await User.me();
      const expirationTime = calculateExpirationTime();
      
      const conversationData = {
        topic_id: selectedTopicId,
        participant1_id: user.id,
        participant2_id: selectedMatch.matchUserId,
        status: "invited",
        started_at: new Date().toISOString()
      };
      
      // Add timer if set
      if (timerDuration > 0) {
        conversationData.timer_duration = convertToMinutes();
        conversationData.expires_at = expirationTime.toISOString();
      }
      
      const newConversation = await Conversation.create(conversationData);
      
      showToast(
        "Invitation sent",
        "We'll notify you when they respond",
        "default"
      );
      
      if (typeof onMatchFound === 'function') {
        onMatchFound(newConversation);
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      showToast(
        "Error sending invitation",
        "Please try again later",
        "destructive"
      );
    } finally {
      setIsMatchSending(false);
    }
  };

  const handleSendInvitationOld = async (partner) => {
    if (!selectedTopic || !partner || !currentUser) {
      showToast(t("Error"), t("Missing information to send invitation"), "destructive");
      return;
    }

    setIsSendingInvitation(prevState => ({ ...prevState, [partner.id]: true }));

    try {
      const existingInvitation = await Conversation.filter({
        topic_id: selectedTopic.id,
        participant1_id: currentUser.id,
        participant2_id: partner.user_id,
        status: "invited",
      });

      if (existingInvitation.length > 0) {
        showToast(t("Invitation already sent"), t("You have already invited this user to discuss this topic."), "destructive");
        setIsSendingInvitation(prevState => ({ ...prevState, [partner.id]: false }));
        return;
      }
      
      const existingActiveOrWaitingConversation = await Conversation.filter({
        topic_id: selectedTopic.id,
        $or: [
          { participant1_id: currentUser.id, participant2_id: partner.user_id, status: { $in: ["active", "waiting", "completion_requested"] } },
          { participant1_id: partner.user_id, participant2_id: currentUser.id, status: { $in: ["active", "waiting", "completion_requested"] } }
        ]
      });

      if (existingActiveOrWaitingConversation.length > 0) {
        showToast(t("Conversation already exists"), t("You already have an active or pending conversation with this user on this topic."), "destructive");
        setIsSendingInvitation(prevState => ({ ...prevState, [partner.id]: false }));
        return;
      }


      const newConversation = await Conversation.create({
        topic_id: selectedTopic.id,
        participant1_id: currentUser.id,
        participant2_id: partner.user_id,
        status: "invited",
        timer_duration: selectedTimerDuration, // Ensure this is captured from TimerSelector
        // expires_at will be set when the invitation is accepted
      });

      showToast(t("Invitation Sent!"), `${t("Your invitation to discuss")} "${selectedTopic.title}" ${t("has been sent to")} ${partner.display_name}.`);
      setSentInvitations(prev => [...prev, partner.user_id]); // Track sent invitations for UI feedback

      // --- Send Push Notification for New Invitation ---
      if (currentUserProfile && selectedTopic) {
        console.log(`Attempting to send NEW_INVITATION push to ${partner.user_id}`);
        sendPushNotification({ // No need to await
          userId: partner.user_id, // The recipient of the invitation
          type: "NEW_INVITATION",
          title: `${currentUserProfile.display_name} ${t("invited you to discuss")}`,
          body: `"${selectedTopic.title}"`,
          data: {
            conversationId: newConversation.id,
            topicId: selectedTopic.id,
            inviterId: currentUser.id,
          }
        });
      }
      // --- End Send Push Notification ---

    } catch (error) {
      console.error("Error sending invitation:", error);
      showToast(t("Error sending invitation"), t("Please try again"), "destructive");
    } finally {
      setIsSendingInvitation(prevState => ({ ...prevState, [partner.id]: false }));
    }
  };
  
  // Calculate expiration time based on timer settings
  const calculateExpirationTime = () => {
    const now = new Date();
    const minutes = convertToMinutes();
    return new Date(now.getTime() + minutes * 60000);
  };
  
  // Convert timer settings to minutes
  const convertToMinutes = () => {
    switch (timerUnit) {
      case 'minutes':
        return timerDuration;
      case 'hours':
        return timerDuration * 60;
      case 'days':
        return timerDuration * 60 * 24;
      default:
        return timerDuration * 60; // Default to hours
    }
  };
  
  // Helper to get stance label
  const getStanceLabel = (stance) => {
    return t(stance) || stance;
  };
  
  // Get match type color
  const getMatchTypeColor = (type) => {
    switch (type) {
      case 'all':
        return 'bg-indigo-100 border-indigo-200 text-indigo-800';
      case 'opposite':
        return 'bg-amber-100 border-amber-200 text-amber-800';
      case 'moderate':
        return 'bg-blue-100 border-blue-200 text-blue-800';
      case 'similar':
        return 'bg-green-100 border-green-200 text-green-800';
      default:
        return '';
    }
  };
  
  // Render match cards
  const renderMatchCard = (match) => {
    const userProfile = match.matchUserProfile;
    if (!userProfile) return null;

    const isExpanded = expandedReasonings.has(match.matchUserId);
    
    return (
      <Card key={match.matchUserId} className="bg-white shadow-sm overflow-hidden">
        <CardContent className="p-2">
          {/* User info section */}
          <div className="flex items-center gap-2 mb-2">
            <Avatar user={userProfile} size="sm" className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{userProfile.display_name}</div>
              <div className="text-xs text-gray-500">
                {t("Level")} {userProfile.level || 1}
              </div>
            </div>
          </div>

          {/* Stance comparison - Mobile-friendly stacked layout */}
          <div className="mb-2 space-y-1">
            <div>
              <div className="text-xs text-gray-500">{t("Your stance")}:</div>
              <div className="text-xs font-medium">{getStanceLabel(match.myStance)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t("Their stance")}:</div>
              <div className="text-xs font-medium">{getStanceLabel(match.matchStance)}</div>
            </div>
          </div>

          {/* Reasoning section with expand/collapse */}
          {match.reasoning && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">{t("Their reasoning")}:</div>
              <div className="bg-gray-50 p-2 rounded-md text-xs overflow-hidden">
                {isExpanded ? (
                  <div>
                    <p className="text-gray-700 break-words">{match.reasoning}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReasoning(match.matchUserId);
                      }}
                      className="h-6 text-xs text-gray-500 p-1 mt-1"
                    >
                      {t("Show less")}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-700 line-clamp-2 break-words">{match.reasoning}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReasoning(match.matchUserId);
                      }}
                      className="h-6 text-xs text-gray-500 p-1 mt-1"
                    >
                      {t("Read more")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Start Discussion button */}
          <Button
            onClick={() => handleMatchSelect(match)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 h-8 text-xs"
            disabled={isMatchSending === match.matchUserId}
          >
            {isMatchSending === match.matchUserId ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {t("Sending...")}
              </>
            ) : (
              t("Start Discussion")
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Match type buttons
  const renderMatchTypeButtons = () => (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <Button
        variant="outline"
        size="sm"
        className={`flex flex-col items-center py-2 h-auto text-xs ${matchType === 'all' ? getMatchTypeColor('all') : ''}`}
        onClick={() => handleMatchTypeChange('all')}
      >
        <Users className="h-4 w-4 mb-1" />
        <span>{t("All Views")}</span>
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        className={`flex flex-col items-center py-2 h-auto text-xs ${matchType === 'opposite' ? getMatchTypeColor('opposite') : ''}`}
        onClick={() => handleMatchTypeChange('opposite')}
      >
        <Sparkles className="h-4 w-4 mb-1" />
        <span>{t("Opposite")}</span>
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        className={`flex flex-col items-center py-2 h-auto text-xs ${matchType === 'moderate' ? getMatchTypeColor('moderate') : ''}`}
        onClick={() => handleMatchTypeChange('moderate')}
      >
        <Scale className="h-4 w-4 mb-1" />
        <span>{t("Moderate")}</span>
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        className={`flex flex-col items-center py-2 h-auto text-xs ${matchType === 'similar' ? getMatchTypeColor('similar') : ''}`}
        onClick={() => handleMatchTypeChange('similar')}
      >
        <Heart className="h-4 w-4 mb-1" />
        <span>{t("Similar")}</span>
      </Button>
    </div>
  );

  // Render step 1: Topic selection
  const renderStep1 = () => (
    <Card className="bg-white border shadow-sm">
      <CardHeader className="border-b p-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-indigo-900">{t("Choose a Topic")}</CardTitle>
            <CardDescription className="text-xs">{t("Select a topic you'd like to discuss")}</CardDescription>
          </div>
          <Badge className="bg-indigo-100 text-indigo-800">1/3</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-3">
        {isLoading && isInitialLoad ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm text-indigo-800">{t("Loading your topics...")}</p>
          </div>
        ) : userTopics.length === 0 ? (
          <div className="text-center py-6">
            <MessageCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-600 mb-2">{t("No opinions shared yet")}</h3>
            <p className="text-gray-500 mb-3 max-w-md mx-auto text-sm">
              {t("You need to share your opinion on at least one topic to find discussion partners")}
            </p>
            <Button
              onClick={() => navigate(createPageUrl("Topics"))}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {t("Explore Topics")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {userTopics.map(topic => (
              <div 
                key={topic.id}
                onClick={() => handleTopicSelect(topic.id)}
                className={`cursor-pointer rounded-lg p-2 transition-all ${
                  isTopicSelected(topic.id) 
                  ? 'bg-indigo-100 border border-indigo-300 shadow' 
                  : 'bg-white hover:bg-indigo-50 border border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">{topic.title}</h3>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {topic.tags && topic.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="bg-gray-50 text-xs px-1 py-0 truncate max-w-[80px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Badge className={`${
                      topic.opinion.stance === 'strongly_agree' || topic.opinion.stance === 'agree' 
                        ? 'bg-green-100 text-green-800' 
                        : topic.opinion.stance === 'neutral'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                    } text-xs px-1 py-0`}>
                      {getStanceLabel(topic.opinion.stance)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {userTopics.length > 0 && (
          <div className="mt-3">
            <Button
              onClick={handleNextStep}
              disabled={!selectedTopicId}
              className="w-full bg-indigo-600 hover:bg-indigo-700 h-9 text-sm flex items-center justify-center"
            >
              {t("Next")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render step 2: Match selection
  const renderStep2 = () => {
    const selectedTopic = allTopics.find(t => t.id === selectedTopicId);
    
    return (
      <Card className="bg-white border shadow-sm">
        <CardHeader className="border-b p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                  className="p-0 h-7 text-gray-500"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("Back")}
                </Button>
                <span className="text-gray-400 mx-1">|</span>
                <CardTitle className="text-base font-bold text-indigo-900">{t("Find Partner")}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {selectedTopic ? (
                  <span className="truncate block max-w-[200px]">
                    {t("Topic")}: {selectedTopic.title}
                  </span>
                ) : t("Choose who you'd like to discuss with")}
              </CardDescription>
            </div>
            <Badge className="bg-indigo-100 text-indigo-800">2/3</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-3">
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-2">{t("Match Type")}:</p>
            {renderMatchTypeButtons()}
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">{t("Potential Partners")}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshMatches}
                className="h-7 w-7 p-0"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-6">
                <Loader2 className="h-7 w-7 text-indigo-600 animate-spin mb-2" />
                <p className="text-xs text-indigo-800">{t("Finding potential partners...")}</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-5 bg-white rounded-lg border border-gray-100">
                <UserRoundSearch className="h-7 w-7 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-gray-600 mb-1">{t("No matches found")}</h3>
                <p className="text-xs text-gray-500 mb-2 max-w-[250px] mx-auto">
                  {t("Try changing your match preferences or share your opinion on more topics")}
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate(createPageUrl("Topics"))}
                  size="sm"
                  className="text-xs"
                >
                  {t("Explore Topics")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {filteredMatches.map(match => renderMatchCard(match))}
              </div>
            )}
            
            <div className="text-center text-xs text-gray-500 mt-2">
              {!isLoading && filteredMatches.length > 0 && (
                <div>{t("Last refreshed")}: {formatLastRefresh()}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render step 3: Timer settings
  const renderStep3 = () => {
    if (!selectedMatch) return null;
    
    const selectedTopic = allTopics.find(t => t.id === selectedTopicId);

    return (
      <Card className="bg-white border shadow-sm">
        <CardHeader className="border-b p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="p-0 h-7 text-gray-500"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("Back")}
                </Button>
                <span className="text-gray-400 mx-1">|</span>
                <CardTitle className="text-base font-bold text-indigo-900">{t("Timer Settings")}</CardTitle>
              </div>
              <CardDescription className="text-xs truncate max-w-[200px]">
                {selectedTopic && (
                  <>
                    {t("Topic")}: {selectedTopic.title}
                  </>
                )}
              </CardDescription>
            </div>
            <Badge className="bg-indigo-100 text-indigo-800">3/3</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              {t("Conversation Timer")}
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              {t("Set how long this conversation will last")}
            </p>
            
            <TimerSelector
              duration={timerDuration}
              unit={timerUnit}
              onDurationChange={setTimerDuration}
              onUnitChange={setTimerUnit}
              className="text-sm"
              // Pass the send invitation handler directly to TimerSelector
              onConfirm={handleSendInvitation}
              confirmButtonText={isMatchSending ? `${t("Sending")}...` : t("Send Invitation")}
              isLoading={isMatchSending}
            />
          </div>
          
          {/* Remove redundant button */}
        </CardContent>
      </Card>
    );
  };

  // Render the current step
  return (
    <div className="w-full max-w-[calc(100vw-24px)] md:max-w-none">
      <Card className="overflow-hidden">
        {currentStep ===  1 && renderStep1()}
        {currentStep ===  2 && renderStep2()}
        {currentStep ===  3 && renderStep3()}
      </Card>
    </div>
  );
}
