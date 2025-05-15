
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Message } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, 
  MessageCircle, 
  Clock,
  CheckCircle,
  Brain,
  Award,
  ChevronLeft,
  Users,
  CheckCircle2,
  User as UserIcon,
  ChevronDown,
  X,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppToast } from "@/components/utils/toast";
import CompletionDialog from "../components/chat/CompletionDialog";
import { Progress } from "@/components/ui/progress";
import { TopicOpinion } from "@/api/entities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Avatar from "@/components/ui/avatar";
import { delay, retryWithBackoff, sendPushNotification } from "@/components/utils/apiHelpers"; // Added sendPushNotification
import { useLanguage } from "@/components/utils/i18n";
import { awardPointsToUser } from "@/components/utils/pointSystem"; // Ensure this is imported

// Add these translation objects at the component level, outside of any function
const welcomeTranslations = {
  en: {
    welcome: 'Welcome to the discussion about "{title}"!',
    stance: '{name} {stance} with this topic, while {otherName} {stance2}.',
    opportunity: 'This is a great opportunity for a thoughtful discussion. Remember to:',
    listen: '• Listen actively to understand different perspectives',
    share: '• Share your viewpoint clearly and respectfully',
    openMind: '• Keep an open mind to new ideas',
    focus: '• Focus on learning from each other',
    begin: "Let's begin!"
  },
  he: {
    welcome: 'ברוכים הבאים לדיון בנושא "{title}"!',
    stance: '{name} {stance} עם נושא זה, בעוד {otherName} {stance2}.',
    opportunity: 'זוהי הזדמנות נהדרת לדיון מעמיק. זכרו:',
    listen: '• להקשיב באופן פעיל כדי להבין נקודות מבט שונות',
    share: '• לשתף את נקודת המבט שלכם בבהירות ובכבוד',
    openMind: '• לשמור על ראש פתוח לרעיונות חדשים',
    focus: '• להתמקד בלמידה זה מזה',
    begin: 'בואו נתחיל!'
  },
  ar: {
    welcome: 'مرحبًا بكم في النقاش حول "{title}"!',
    stance: '{name} {stance} مع هذا الموضوع، بينما {otherName} {stance2}.',
    opportunity: 'هذه فرصة رائعة لإجراء مناقشة هادفة. تذكر أن:',
    listen: '• تستمع بنشاط لفهم وجهات النظر المختلفة',
    share: '• تشارك وجهة نظرك بوضوح واحترام',
    openMind: '• تحافظ على عقل منفتح للأفكار الجديدة',
    focus: '• تركز على التعلم من بعضكم البعض',
    begin: 'لنبدأ!'
  }
};

const stanceTranslations = {
  en: {
    strongly_agree: 'strongly agrees',
    agree: 'agrees',
    neutral: 'is neutral',
    disagree: 'disagrees',
    strongly_disagree: 'strongly disagrees'
  },
  he: {
    strongly_agree: 'מסכים/ה בהחלט',
    agree: 'מסכים/ה',
    neutral: 'ניטרלי/ת',
    disagree: 'לא מסכים/ה',
    strongly_disagree: 'בהחלט לא מסכים/ה'
  },
  ar: {
    strongly_agree: 'يوافق بشدة',
    agree: 'يوافق',
    neutral: 'محايد',
    disagree: 'لا يوافق',
    strongly_disagree: 'لا يوافق بشدة'
  }
};

export default function ChatView() {
  // Add this debugging function at the beginning of the component
  const debugMessage = (message) => {
    console.log("Message analysis data:", {
      id: message.id,
      content: message.content,
      analysis_feedback: message.content,
      analysis_tips: message.analysis_tips,
      biases_detected: message.biases_detected,
      score_change: message.score_change
    });
  };
  
  const [conversation, setConversation] = useState(null);
  const [topic, setTopic] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // Initialize userProfiles with empty object
  const [userProfiles, setUserProfiles] = useState({});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false); 
  const [isWaiting, setIsWaiting] = useState(isSending);
  const [isPolling, setIsPolling] = useState(true);
  const [analysisShownForMessage, setAnalysisShownForMessage] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [recentUserMessages, setRecentUserMessages] = useState([]);
  const [participantOpinions, setParticipantOpinions] = useState({});
  const [isObserver, setIsObserver] = useState(false);
  
  // New state for smart scrolling
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  
  const pollingInterval = useRef(null);
  const messageEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get("id");

  // Add timer states
  const [timerExpiry, setTimerExpiry] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);

  // Add function to format time remaining
  const formatTimeRemaining = (milliseconds) => {
    if (!milliseconds) return "";
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Add function to handle auto-completion
  const handleAutoComplete = async () => {
    if (!conversation) return;
    
    try {
      // Create standard feedback for auto-completion
      const autoCompletionFeedback = [
        {
          user_id: conversation.participant1_id,
          timestamp: new Date().toISOString(),
          feedback: "This conversation was automatically completed due to the timer expiring."
        },
        {
          user_id: conversation.participant2_id,
          timestamp: new Date().toISOString(),
          feedback: "This conversation was automatically completed due to the timer expiring."
        }
      ];

      // Update conversation status
      await Conversation.update(conversation.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_feedback: autoCompletionFeedback,
        auto_completed: true
      });

      // Award completion bonus points
      await awardCompletionBonus();

      showToast(
        "Conversation completed",
        "Time limit reached",
        "default"
      );

      // Reload conversation
      loadConversation(conversation.id);
    } catch (error) {
      console.error("Error auto-completing conversation:", error);
    }
  };

  const getOtherParticipantId = () => {
    if (!conversation || !userId) return null;
    return conversation.participant1_id === userId
      ? conversation.participant2_id
      : conversation.participant1_id;
  };
  
  const getUserScore = () => {
    if (!conversation || !userId) return { empathy: 0, clarity: 0, open_mindedness: 0, total: 0 };
    
    const scoreField = conversation.participant1_id === userId
      ? "participant1_score"
      : "participant2_score";
    
    // Get score from conversation
    const score = conversation[scoreField] || { 
      empathy: 0, 
      clarity: 0, 
      open_mindedness: 0, 
      total: 0 
    };

    // Calculate total if not present
    if (!score.total) {
      score.total = score.empathy + score.clarity + score.open_mindedness;
    }

    return score;
  };
  
  const handleComplete = async (feedback) => {
    if (!conversation) return;
    
    try {
      // Create completion request instead of immediate feedback
      await Conversation.update(conversation.id, {
        status: "completion_requested",
        completion_request: {
          requested_by: userId,
          requested_at: new Date().toISOString(),
          feedback: feedback
        }
      });
      
      setShowCompletionDialog(false);
      loadConversation(conversation.id);
      
      showToast(
        "Completion requested",
        "Waiting for the other participant to accept or reject"
      );
      
    } catch (error) {
      console.error("Error requesting completion:", error);
      showToast(
        "Error requesting completion",
        "Please try again later",
        "destructive"
      );
    }
  };

  // Modify handleAcceptCompletion to call awardCompletionBonus directly
  const handleAcceptCompletion = async (feedback) => {
    try {
      const completionFeedback = [
        {
          user_id: conversation.completion_request.requested_by,
          timestamp: conversation.completion_request.requested_at,
          feedback: conversation.completion_request.feedback
        },
        {
          user_id: userId,
          timestamp: new Date().toISOString(),
          feedback: feedback
        }
      ];

      // First close the dialog to prevent it from reopening
      setShowCompletionDialog(false);

      // Update conversation status
      await Conversation.update(conversation.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_feedback: completionFeedback,
        completion_request: null
      });

      // Award completion bonus points
      await awardCompletionBonus();

      showToast("Conversation completed successfully");

      // Load the conversation after a slight delay to ensure state is updated properly
      setTimeout(() => {
        loadConversation(conversation.id);
      }, 300);
    } catch (error) {
      console.error("Error accepting completion:", error);
      showToast(
        "Error accepting completion",
        "Please try again later",
        "destructive"
      );
    }
  };
  
  // Enhanced awardCompletionBonus function
  const awardCompletionBonus = async () => {
    try {
      const currentUser = await User.me(); 
      if (!currentUser || !currentUser.id) {
        console.error("awardCompletionBonus: Current user not found.");
        showToast("Error", "Could not identify user for point awarding.", "destructive");
        return false;
      }

      const completionBonus = 20;

      // Award points to the current user (this handles profile creation/update and conversation count)
      // The 'conversation_complete' category in awardPointsToUser handles incrementing conversations_completed
      const updatedCurrentUserProfile = await awardPointsToUser(currentUser.id, completionBonus, 'conversation_complete');
      
      if (updatedCurrentUserProfile) {
        const oldLevel = userProfile?.level || 1; // Get level before update from local state
        setUserProfile(updatedCurrentUserProfile); // Update local state with the returned profile
        
        showToast(`+${completionBonus} XP awarded!`, "Bonus for completing the conversation.", "default");
        
        if (updatedCurrentUserProfile.level > oldLevel) {
          showToast(
            "Level Up!", 
            `Congratulations! You're now level ${updatedCurrentUserProfile.level}!`, 
            "default", 
            <Award className="h-6 w-6 text-yellow-500" />
          );
        }
        // updateBadgesBasedOnConversations relies on conversations_completed which awardPointsToUser should have updated
        await updateBadgesBasedOnConversations(updatedCurrentUserProfile.conversations_completed, updatedCurrentUserProfile);
      } else {
        console.error(`Failed to award points or update profile for current user ${currentUser.id}`);
        showToast("Profile Update Issue", "Could not update your profile with completion bonus.", "warning");
      }

      // Award points to the other participant
      const otherParticipantId = getOtherParticipantId();
      if (otherParticipantId) {
        // This will also handle their profile creation/update and conversation_complete count
        await awardPointsToUser(otherParticipantId, completionBonus, 'conversation_complete');
        // We don't need to update their local profile state here or show them toasts directly from this client.
        // Their profile will reflect changes when their client fetches data.
      }
      
      return true;
    } catch (error) {
      console.error("Error in awardCompletionBonus:", error);
      showToast("Bonus Error", "An error occurred awarding completion bonuses.", "destructive");
      return false;
    }
  };
  
  // Add badge awarding function
  const updateBadgesBasedOnConversations = async (conversationsCount, profile) => {
    if (!profile) return;
    
    const badges = [...(profile.badges || [])];
    let badgesChanged = false;
    
    // Award first conversation badge
    if (conversationsCount >= 1 && !badges.includes("first_conversation")) {
      badges.push("first_conversation");
      badgesChanged = true;
      showToast(
        "New Badge Earned!",
        "First Chat: Completed your first conversation",
        "default",
        <MessageCircle className="h-6 w-6 text-green-500" />
      );
    }
    
    // Award five conversations badge
    if (conversationsCount >= 5 && !badges.includes("five_conversations")) {
      badges.push("five_conversations");
      badgesChanged = true;
      showToast(
        "New Badge Earned!",
        "Conversation Starter: Completed 5 conversations",
        "default",
        <MessageCircle className="h-6 w-6 text-indigo-500" />
      );
    }
    
    // Award ten conversations badge
    if (conversationsCount >= 10 && !badges.includes("ten_conversations")) {
      badges.push("ten_conversations");
      badgesChanged = true;
      showToast(
        "New Badge Earned!",
        "Social Butterfly: Completed 10 conversations",
        "default",
        <Users className="h-6 w-6 text-purple-500" />
      );
    }
    
    // Update profile if new badges were added
    if (badgesChanged) {
      try {
        const updatedProfile = await UserProfile.update(profile.id, {
          badges: badges
        });
        setUserProfile(updatedProfile);
      } catch (error) {
        console.error("Error updating badges:", error);
      }
    }
  };

  const handleRejectCompletion = async () => {
    try {
      await Conversation.update(conversation.id, {
        status: "active",
        completion_request: null
      });

      showToast(
        "Completion request rejected",
        "You can continue the conversation",
        "default"
      );
      loadConversation(conversation.id);
    } catch (error) {
      console.error("Error rejecting completion:", error);
      showToast(
        "Error rejecting completion",
        "Please try again later",
        "destructive"
      );
    }
  };

  // Helper to check if current user requested completion
  const isCompletionRequester = () => {
    return conversation?.completion_request?.requested_by === userId;
  };

  // Add helper function to check if both participants have completed
  const hasUserCompleted = (userId) => {
    return conversation?.completion_feedback?.some(fb => fb.user_id === userId) || false;
  };

  // Add effect to initialize timer
  useEffect(() => {
    if (conversation?.expires_at) {
      const expiry = new Date(conversation.expires_at);
      setTimerExpiry(expiry);
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Set up timer to update remaining time
      timerRef.current = setInterval(() => {
        const now = new Date();
        const remaining = expiry - now;
        
        if (remaining <= 0) {
          // Time's up!
          clearInterval(timerRef.current);
          setTimeRemaining(0);
          
          // Only auto-complete if conversation is still active
          if (conversation.status === "active" || 
              conversation.status === "waiting") {
            handleAutoComplete();
          }
        } else {
          setTimeRemaining(remaining);
        }
      }, 1000);
    } else {
      setTimerExpiry(null);
      setTimeRemaining(null);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [conversation?.expires_at, conversation?.status]);

  // Helper function to safely get user profile
  const getSafeProfile = (userId) => {
    if (!userId) return null;
    return userProfiles[userId] || null;
  };

  // Add more logging to track profile loading
  useEffect(() => {
    if (conversation) {
      console.log("Current conversation:", conversation);
      console.log("Current userProfiles state:", userProfiles);
      console.log("Participant 1 profile:", getSafeProfile(conversation.participant1_id));
      console.log("Participant 2 profile:", getSafeProfile(conversation.participant2_id));
    }
  }, [conversation, userProfiles]);

const loadUserProfiles = async () => {
  if (!conversation) {
    console.log("No conversation available");
    return;
  }
  
  const participantIds = [
    conversation.participant1_id,
    conversation.participant2_id
  ].filter(Boolean);
  
  console.log("Loading profiles for participants:", participantIds);
  
  try {
    // Load profiles sequentially with explicit logging
    for (const participantId of participantIds) {
      console.log(`Attempting to load profile for ${participantId}`);
      
      try {
        // First try to get from existing profiles
        if (userProfiles[participantId]?.display_name) {
          console.log(`Already have profile for ${participantId}:`, userProfiles[participantId]);
          continue;
        }

        // Make the API call with explicit await
        console.log(`Making API call to fetch profile for ${participantId}`);
        const profiles = await UserProfile.filter({ user_id: participantId });
        console.log(`Received profiles for ${participantId}:`, profiles);

        if (profiles && profiles.length > 0) {
          console.log(`Setting profile for ${participantId}:`, profiles[0]);
          setUserProfiles(prev => ({
            ...prev,
            [participantId]: profiles[0]
          }));
        } else {
          console.log(`No profile found for ${participantId}, creating fallback`);
          setUserProfiles(prev => ({
            ...prev,
            [participantId]: {
              user_id: participantId,
              display_name: `User ${participantId.substring(0, 5)}`,
              avatar_color: getRandomColor()
            }
          }));
        }
      } catch (error) {
        console.error(`Error loading profile for ${participantId}:`, error);
        // Set fallback profile on error
        setUserProfiles(prev => ({
          ...prev,
          [participantId]: {
            user_id: participantId,
            display_name: `User ${participantId.substring(0, 5)}`,
            avatar_color: getRandomColor()
          }
        }));
      }
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error("Error in loadUserProfiles:", error);
  }
};

// Add effect to trigger profile loading when conversation changes
useEffect(() => {
  if (conversation) {
    console.log("Conversation changed, triggering profile load");
    loadUserProfiles();
  }
}, [conversation]);

// Add additional effect to check for missing profiles
useEffect(() => {
  const checkMissingProfiles = async () => {
    if (!conversation || !userProfiles) return;
    
    const participantIds = [
      conversation.participant1_id,
      conversation.participant2_id
    ].filter(Boolean);
    
    const missingProfiles = participantIds.filter(id => !userProfiles[id]);
    
    if (missingProfiles.length > 0) {
      console.log("Found missing profiles:", missingProfiles);
      await loadUserProfiles();
    }
  };
  
  checkMissingProfiles();
}, [userProfiles, conversation]);

  // Update the loadConversation function to properly handle profile loading
  const loadConversation = async () => {
    setIsLoading(true);
    try {
      if (!conversationId) {
        navigate(createPageUrl("Conversations"));
        return;
      }

      // Load data with retry and backoff
      const [
        conversationData,
        user
      ] = await Promise.all([
        retryWithBackoff(() => Conversation.get(conversationId)),
        retryWithBackoff(() => User.me()),
      ]);

      setConversation(conversationData);
      setUserId(user.id);

      // Check if user is an observer
      const isUserParticipant = conversationData.participant1_id === user.id || 
                               conversationData.participant2_id === user.id;
      setIsObserver(!isUserParticipant);

      // Load topic with retry
      try {
        const topicData = await retryWithBackoff(() => 
          Topic.get(conversationData.topic_id)
        );
        setTopic(topicData);
      } catch (error) {
        console.error("Error loading topic:", error);
        setTopic({
          id: conversationData.topic_id,
          title: "Topic Unavailable",
          description: "This topic is no longer available",
          category: "Unknown"
        });
      }

      // Load user profile
      try {
        const userProfilesData = await UserProfile.filter({ user_id: user.id });
        if (userProfilesData.length > 0) {
          setUserProfile(userProfilesData[0]);
          // Also add to userProfiles state
          setUserProfiles(prev => ({
            ...prev,
            [user.id]: userProfilesData[0]
          }));
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
      }
        
      // Load both participants' profiles
      await loadUserProfiles();

      // Load participants' opinions for this topic
      const opinions = {};
      const participantIds = [conversationData.participant1_id, conversationData.participant2_id];

      for (const pid of participantIds) {
        try {
          const userOpinions = await TopicOpinion.filter({ 
            user_id: pid,
            topic_id: conversationData.topic_id
          });
          
          if (userOpinions.length > 0) {
            opinions[pid] = userOpinions[0];
          }
        } catch (opinionError) {
          console.error(`Error loading opinion for participant ${pid}:`, opinionError);
        }
      }
      
      setParticipantOpinions(opinions);
      
    } catch (error) {
      console.error("Error loading conversation:", error);
      showToast(
        "Error loading conversation",
        "Please try again later",
        "destructive"
      );
      navigate(createPageUrl("Conversations"));
    }
    setIsLoading(false);
  };

  // Add an effect to monitor userProfiles changes
  useEffect(() => {
    console.log("userProfiles updated:", userProfiles);
  }, [userProfiles]);

  useEffect(() => {
    loadConversation();
    
    // Reduce message polling frequency and add cache
    const messageInterval = setInterval(() => {
      // loadMessages will handle its own internal cache check
      loadMessages();
    }, 10000); // Poll for messages every 10 seconds
    
    return () => clearInterval(messageInterval);
  }, [conversationId]);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      // Check message cache first
      const cachedMessages = localStorage.getItem(`messages_${conversationId}`);
      const cacheTime = parseInt(localStorage.getItem(`messages_time_${conversationId}`) || '0');
      const now = Date.now();
      
      // Use cache if it's less than 10 seconds old (increased from 3)
      if (cachedMessages && now - cacheTime < 10000) {
        setMessages(JSON.parse(cachedMessages));
        return;
      }

      const newMessages = await retryWithBackoff(() => 
        Message.filter({ conversation_id: conversationId }, 'sent_at')
      );

      // Transform messages
      const processedMessages = newMessages.map(message => ({
        ...message,
        score_change: message.score_change || {
          empathy: 0,
          clarity: 0,
          open_mindedness: 0
        },
        biases_detected: message.biases_detected || [],
        consistency_issues: message.consistency_issues || [],
        analysis_feedback: message.analysis_feedback || "",
        analysis_tips: message.analysis_tips || "",
        score_explanation: message.score_explanation || {}
      }));
      
      setMessages(processedMessages);
      
      // Cache the messages
      localStorage.setItem(`messages_${conversationId}`, JSON.stringify(processedMessages));
      localStorage.setItem(`messages_time_${conversationId}`, now.toString());
      
    } catch (error) {
      console.error("Error loading messages:", error);
      // Use cached messages as fallback
      const cachedMessages = localStorage.getItem(`messages_${conversationId}`);
      if (cachedMessages) {
        setMessages(JSON.parse(cachedMessages));
      }
    }
  };

  // Add retry utility function (same as in Conversations.jsx)
  const retryWithBackoff = async (fn, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (error.response?.status === 429) {
          const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries reached');
  };

  // Handle scroll detection and smart auto-scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!chatContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
      
      // User is considered to be scrolling if they're not at the bottom
      setIsUserScrolling(!isAtBottom);
      setShouldScrollToBottom(isAtBottom);
      
      // If user scrolls to bottom manually, clear new message indicator
      if (isAtBottom) {
        setHasNewMessage(false);
      }
    };
    
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Smart scroll behavior when messages change
  useEffect(() => {
    // Only auto-scroll if we should scroll to bottom
    if (!shouldScrollToBottom) {
      // If new messages came in but user is scrolling elsewhere, show indicator
      if (messages.length > prevMessagesLength.current) {
        setHasNewMessage(true);
      }
    } else if (conversation?.status !== "completed" && conversation?.status !== "abandoned") {
      // Auto-scroll only if conversation is active and user is at the bottom
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    
    // Store the current message count for next comparison
    prevMessagesLength.current = messages.length;
  }, [messages, shouldScrollToBottom, conversation?.status]);

  // Function to manually scroll to bottom when user clicks the indicator
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessage(false);
    setShouldScrollToBottom(true);
  };

  // Update the polling effect for conversation status with better rate limit handling
  useEffect(() => {
    if (conversation && isPolling) {
      let lastPollTime = Date.now();
      // Increased MINIMUM_POLL_INTERVAL for conversation status
      const MINIMUM_POLL_INTERVAL = 7500; // Minimum 7.5 seconds between polls
      
      const pollWithBackoff = async () => {
        try {
          // Ensure minimum time between polls
          const timeSinceLastPoll = Date.now() - lastPollTime;
          if (timeSinceLastPoll < MINIMUM_POLL_INTERVAL) {
            await delay(MINIMUM_POLL_INTERVAL - timeSinceLastPoll);
          }

          const [updatedConversation] = await Promise.all([
            retryWithBackoff(
              () => Conversation.get(conversation.id),
              3,
              2000 
            )
          ]);
          
          if (updatedConversation.status !== conversation.status || 
              updatedConversation.completion_request !== conversation.completion_request) { // check completion_request too
            setConversation(updatedConversation);
          }

          lastPollTime = Date.now();
        } catch (error) {
          console.error("Error polling for updates:", error);
          if (error.response?.status === 429 || error.message?.includes("Rate limit")) {
            await delay(15000); // Wait 15 seconds before next poll on rate limit
          }
        }
      };

      // Initial poll
      pollWithBackoff();

      // Set up polling interval with dynamic adjustment
      // The interval itself matches MINIMUM_POLL_INTERVAL now
      pollingInterval.current = setInterval(pollWithBackoff, MINIMUM_POLL_INTERVAL);

      return () => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }
  }, [conversation, isPolling]);

  // Stop polling when sending a message to avoid conflicts
  useEffect(() => {
    setIsPolling(!isSending && !isWaiting);
  }, [isSending, isWaiting]);

  // COMPLETELY DISABLE POLLING WHEN ANALYSIS IS SHOWING
  useEffect(() => {
    if (analysisShownForMessage) {
      // Pause polling when showing analysis
      setIsPolling(false);
    } else {
      // Resume polling when not showing analysis
      setIsPolling(!isSending && !isWaiting);
    }
  }, [analysisShownForMessage, isSending, isWaiting]);

  useEffect(() => {
    if (messages.length > 0) {
      // Update recent messages tracking when messages change
      const userMsgs = messages.filter(msg => msg.sender_id === userId);
      setRecentUserMessages(userMsgs);
    }
  }, [messages, userId]);

  // Update helper function to format stance
  const formatStance = (stance) => {
    if (!stance) return "No opinion";
    
    switch (stance) {
      case 5: return "Strongly Agrees";
      case 4: return "Agrees";
      case 3: return "Neutral";
      case 2: return "Disagrees";
      case 1: return "Strongly Disagrees";
      default: return stance;
    }
  };

  // Update helper function for stance color
  const getStanceColor = (stance) => {
    if (!stance) return "bg-gray-100 text-gray-600";
    
    switch (stance) {
      case "strongly_agree": return "bg-green-100 text-green-800";
      case "agree": return "bg-emerald-100 text-emerald-800";
      case "neutral": return "bg-blue-100 text-blue-800";
      case "disagree": return "bg-amber-100 text-amber-800";
      case "strongly_disagree": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  // Add helper function for random colors
  const getRandomColor = () => {
    const colors = [
      "#6366F1", // Indigo
      "#8B5CF6", // Purple
      "#EC4899", // Pink
      "#F43F5E", // Rose
      "#10B981", // Emerald
      "#06B6D4", // Cyan
      "#F59E0B", // Amber
      "#EF4444"  // Red
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Also update the generateOpinionSummary function to handle missing profiles better
  const generateOpinionSummary = () => {
    if (!conversation) return "Welcome to the discussion!";
    
    const participant1 = userProfiles[conversation.participant1_id] || { 
      display_name: `User ${conversation.participant1_id.substring(0, 5)}` 
    };
    const participant2 = userProfiles[conversation.participant2_id] || {
      display_name: `User ${conversation.participant2_id.substring(0, 5)}`
    };
    
    const opinion1 = participantOpinions[conversation.participant1_id];
    const opinion2 = participantOpinions[conversation.participant2_id];

    // Get names with better fallbacks
    const p1Name = participant1?.display_name || `User ${conversation.participant1_id.substring(0, 5)}`;
    const p2Name = participant2?.display_name || `User ${conversation.participant2_id.substring(0, 5)}`;
    
    // Format stance text
    const formatStance = (stance) => {
      if (!stance) return "has no opinion";
      
      switch (stance) {
        case "strongly_agree": return "strongly agrees";
        case "agree": return "agrees";
        case "neutral": return "is neutral";
        case "disagree": return "disagrees";
        case "strongly_disagree": return "strongly disagrees";
        default: return "has no opinion";
      }
    };

    // Replace generic "Participant X" with actual names
    const isUser1 = userId === conversation.participant1_id;
    const userText = isUser1 ? p1Name : p2Name;
    const otherName = isUser1 ? p2Name : p1Name;
    
    return `Welcome to the discussion about "${topic?.title}"!\n\n` +
           `${isUser1 ? userText : otherName} ${formatStance(opinion1?.stance)} with this topic, while ` +
           `${isUser1 ? otherName : userText} ${formatStance(opinion2?.stance)}.\n\n` +
           `This is a great opportunity for a thoughtful discussion. Remember to:\n` +
           `• Listen actively to understand different perspectives\n` +
           `• Share your viewpoint clearly and respectfully\n` +
           `• Keep an open mind to new ideas\n` +
           `• Focus on learning from each other\n\n` +
           `Let's begin!`;
  };

// Update the getWelcomeMessage function to properly define opinion1 and opinion2
const getWelcomeMessage = () => {
  if (!topic || !conversation) return '';
  
  // Determine which language to use - prioritize topic language, fall back to UI language
  const topicLang = topic.language || currentLanguage;
  const translations = welcomeTranslations[topicLang] || welcomeTranslations.en;
  const stanceTranslation = stanceTranslations[topicLang] || stanceTranslations.en;
  
  // Get participant profiles with proper null checks
  const participant1 = userProfiles[conversation.participant1_id] || { 
    display_name: `User ${conversation.participant1_id.substring(0, 5)}` 
  };
  const participant2 = userProfiles[conversation.participant2_id] || {
    display_name: `User ${conversation.participant2_id.substring(0, 5)}`
  };
  
  // Get participant opinions with proper null checks
  const opinion1 = participantOpinions[conversation.participant1_id];
  const opinion2 = participantOpinions[conversation.participant2_id];
  
  // Format stance in the correct language
  const formatStance = (stance) => {
    if (!stance) return stanceTranslation.neutral || "is neutral";
    return stanceTranslation[stance] || stance;
  };
  
  // Get names with better fallbacks
  const p1Name = participant1?.display_name || `User ${conversation.participant1_id.substring(0, 5)}`;
  const p2Name = participant2?.display_name || `User ${conversation.participant2_id.substring(0, 5)}`;
  
  // Replace generic "Participant X" with actual names
  const isUser1 = userId === conversation.participant1_id;
  const userText = isUser1 ? p1Name : p2Name;
  const otherName = isUser1 ? p2Name : p1Name;
  
  return translations.welcome.replace('{title}', topic.title) + '\n\n' +
         translations.stance
           .replace('{name}', isUser1 ? userText : otherName)
           .replace('{stance}', formatStance(opinion1?.stance))
           .replace('{otherName}', isUser1 ? otherName : userText)
           .replace('{stance2}', formatStance(opinion2?.stance)) + '\n\n' +
         translations.opportunity + '\n' +
         translations.listen + '\n' +
         translations.share + '\n' +
         translations.openMind + '\n' +
         translations.focus + '\n\n' +
         translations.begin;
};

  const handleAcceptInvitation = async () => {
    if (!conversation) return;
    
    setIsAccepting(true);
    try {
      // Wait for profiles to be loaded before generating the summary
      await loadUserProfiles();
      
      // First update the conversation status
      const updatedConversation = await Conversation.update(conversation.id, {
        status: "waiting"
      });
      
      // Generate and send the introduction message
      const introMessageContent = getWelcomeMessage();
      await Message.create({
        conversation_id: conversation.id,
        sender_id: "system",
        content: introMessageContent,
        message_type: "system",
        sent_at: new Date().toISOString()
      });
      
      setConversation(updatedConversation);
      showToast(
        "Invitation accepted", 
        "You can now start the conversation"
      );

      // --- Send Push Notification for Invitation Accepted ---
      const inviterId = conversation.participant1_id;
      const accepterProfile = userProfile; // current user's profile

      if (inviterId && userId !== inviterId) {
        console.log(`Attempting to send INVITATION_ACCEPTED push to ${inviterId}`);
        sendPushNotification({ // No need to await
          userId: inviterId,
          type: "INVITATION_ACCEPTED",
          title: "Invitation Accepted!",
          body: `${accepterProfile?.display_name || 'Someone'} accepted your invitation to discuss "${topic?.title || 'a topic'}"`,
          data: {
            conversationId: conversation.id,
            accepterId: userId,
            topicId: topic?.id
          }
        });
      }
      // --- End Send Push Notification ---
      
    } catch (error) {
      console.error("Error accepting invitation:", error);
      showToast(
        "Error accepting invitation", 
        "Please try again later", 
        "destructive"
      );
    }
    setIsAccepting(false);
  };

  const handleRejectInvitation = async () => {
    if (!conversation) return;
    
    try {
      await Conversation.update(conversation.id, {
        status: "rejected"
      });
      
      showToast(
        "Invitation declined", 
        "The invitation has been declined"
      );
      
      navigate(createPageUrl("Conversations"));
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      showToast(
        "Error declining invitation", 
        "Please try again later", 
        "destructive"
      );
    }
  };

  const calculateSpamPenalty = (recentMessages, consecutiveCount) => {
    if (recentMessages.length < 3) return 0;
    
    // If user has sent more than 3 consecutive messages, return special flag for zero score
    if (consecutiveCount > 3) {
      return "ZERO_SCORE"; // Special flag to indicate scores should be zeroed
    }
    
    // Look at messages in the last 2 minutes to detect spam patterns
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentMsgs = recentMessages.filter(msg => 
      new Date(msg.sent_at) > twoMinutesAgo
    );
    
    // If less than 3 messages, no penalty
    if (recentMsgs.length < 3) return 0;
    
    // Heavy penalty for 3 consecutive messages
    const consecutivePenalty = Math.min(20, consecutiveCount - 2) * 6;
    
    // Additional penalty for very short messages
    const shortMessages = recentMsgs.filter(msg => msg.content.length < 50);
    const shortMessagePenalty = shortMessages.length * 0.5;

    // Check time between messages - penalize rapid succession
    let rapidMessagePenalty = 0;
    for (let i = 1; i < recentMsgs.length; i++) {
      const timeDiff = new Date(recentMsgs[i].sent_at) - new Date(recentMsgs[i-1].sent_at);
      if (timeDiff < 15000) { // Less than 15 seconds between messages
        rapidMessagePenalty += 1;
      }
    }

    // Total penalty
    let totalPenalty = Math.min(20, consecutivePenalty + shortMessagePenalty + rapidMessagePenalty);
    return totalPenalty;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation) return;
    
    setIsSending(true);
    const currentMessageContent = newMessage; // Store content before clearing
    
    try {
      console.log(`Sending message in conversation ${conversation.id}`);
      
      const message = await Message.create({
        conversation_id: conversation.id,
        sender_id: userId,
        content: currentMessageContent, // Use stored content
        message_type: "user",
        sent_at: new Date().toISOString()
      });
      
      console.log(`Message created with ID: ${message.id}`);
      setMessages(prev => [...prev, message]);
      setNewMessage("");
      
      if (conversation.status === "waiting") {
        // ... keep existing code (update conversation to active)
        const now = new Date();
        let expiryDate = null;
        
        if (conversation.timer_duration) {
          expiryDate = new Date(now.getTime() + conversation.timer_duration * 60 * 1000);
        }
        
        const updatedConv = await Conversation.update(conversation.id, {
          status: "active",
          started_at: now.toISOString(),
          expires_at: expiryDate ? expiryDate.toISOString() : null
        });
        
        setConversation(updatedConv);
      }
      
      // --- Send Push Notification for New Message ---
      const recipientId = getOtherParticipantId();
      const senderProfile = userProfile; // current user's profile
      
      if (recipientId && userId !== recipientId) { // Ensure not sending to self if in a solo/test convo
        console.log(`Attempting to send NEW_MESSAGE push to ${recipientId}`);
        sendPushNotification({ // No need to await this, let it run in background
          userId: recipientId,
          type: "NEW_MESSAGE",
          title: `${senderProfile?.display_name || 'Someone'} sent you a message`,
          body: `${currentMessageContent.substring(0, 100)}${currentMessageContent.length > 100 ? '...' : ''}`,
          data: {
            conversationId: conversation.id,
            senderId: userId,
            messageId: message.id
          }
        });
      }
      // --- End Send Push Notification ---
      
      setIsWaiting(true);

      // ... keep existing code (AI analysis prompt, InvokeLLM call, message update, score update)
      // Get recent messages for context, but be more precise about the timeline
      const recentMessagesTimestamp = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
      const conversationContext = messages
        .filter(msg => new Date(msg.sent_at) > recentMessagesTimestamp)
        .slice(-10); // Limit to last 10 messages

      // Add evaluation for message length quality
      const messageLength = currentMessageContent.trim().length; // Use stored content
      const wordCount = currentMessageContent.trim().split(/\s+/).length; // Use stored content
      
      // Calculate length quality penalty
      let lengthQualityPenalty = 0;
      let isExtremeTooShort = false;
      
      if (wordCount < 3) {
        // Extreme penalty for extremely short messages (1-2 words)
        lengthQualityPenalty = 8;
        isExtremeTooShort = true;
      } else if (wordCount < 5) {
        // Significant penalty for very short messages (3-4 words)
        lengthQualityPenalty = 5;
      } else if (wordCount < 8) {
        // Moderate penalty for short messages (5-7 words)
        lengthQualityPenalty = 3;
      }
      
      // Add analysis of justification and evidence
      const hasJustificationMarkers = /because|since|as|given that|due to|therefore|thus|hence|consequently|reason|evidence|study|research|according to|source|example|instance|case|data|statistics|figure|result/i.test(currentMessageContent); // Use stored content
      
      // Check for reasoning patterns
      const hasReasoningPatterns = /if.*then|consider|analyzing|when we look at|examining|from this perspective|this suggests|this indicates|this demonstrates|this shows|in contrast|on the other hand|alternatively|however|nevertheless/i.test(currentMessageContent); // Use stored content
      
      // Check for qualifying statements that show nuance
      const hasQualifiers = /sometimes|often|generally|typically|in most cases|usually|primarily|mainly|largely|to some extent|somewhat|relatively|comparatively|arguably|potentially|possibly|perhaps|maybe|likely|unlikely/i.test(currentMessageContent); // Use stored content
      
      // Overall evidence assessment
      const evidenceAssessment = 
        (hasJustificationMarkers ? "Has justification markers" : "Lacks explicit justification") + ", " +
        (hasReasoningPatterns ? "Shows reasoning patterns" : "Limited reasoning demonstrated") + ", " +
        (hasQualifiers ? "Uses nuanced qualifiers" : "Uses absolute statements without qualification");
      
      // Substance score modifier
      const substanceScore = 
        (hasJustificationMarkers ? 3 : 0) + 
        (hasReasoningPatterns ? 2 : 0) + 
        (hasQualifiers ? 1 : 0);
      
      // Structure the conversation context with more detail
      const formattedContext = conversationContext.map((msg, index) => ({
        sender: msg.sender_id === userId ? "current_user" : 
               (msg.sender_id === "system" ? "system" : "other_user"),
        content: msg.content,
        timestamp: msg.sent_at,
        hasResponse: index < conversationContext.length - 1 && 
                    conversationContext[index + 1].sender_id !== msg.sender_id,
        wordCount: msg.content.trim().split(/\s+/).length // Add word count to context
      }));

      // Count consecutive messages
      const consecutiveCount = getConsecutiveMessageCount(userId, messages);
      
      // Only include consecutive message warning if count is getting high
      const consecutiveWarning = consecutiveCount >= 2 ? 
        `\nIMPORTANT: The user has sent ${consecutiveCount} consecutive messages. ${
          consecutiveCount >= 3 
            ? "This many consecutive messages without responses can hinder dialogue."
            : "Be aware of message frequency and allow time for responses."
        }` : "";

      const topicData = await Topic.get(topic.id);
      const responseLanguage = topicData.language === 'en' ? 'English' : 'Hebrew';

      const analysisPrompt = `
        I need to analyze a message in a conversation about "${topic?.title}".

        The language code for this discussion is ${responseLanguage}.
        All feedback must be sent in this language.
        
        Current message: "${currentMessageContent}"
        Sender: current_user
        
        MESSAGE QUALITY METRICS:
        - Character Count: ${messageLength}
        - Word Count: ${wordCount}
        - Evidence Analysis: ${evidenceAssessment}
        - Substance Score: ${substanceScore}/6 (higher is better)
        ${consecutiveCount >= 2 ? `- Consecutive Messages: ${consecutiveCount}` : ""}
        
        RECENT CONVERSATION CONTEXT:
        ${formattedContext.map(msg => 
          `[${msg.sender}]: "${msg.content}" (${new Date(msg.timestamp).toLocaleTimeString()}) [Words: ${msg.wordCount}]` +
          `${msg.hasResponse ? ' [received response]' : ''}`
        ).join('\n')}
        
        IMPORTANT SCORING RULES:
        1. EVIDENCE-BASED SCORING: High scores should be given primarily for claims WITH supporting reasoning/evidence
        2. QUALITY STANDARD: Unsupported opinions and mere assertions should receive modest scores (0-5)
        3. QUALITY STANDARD: Well-reasoned arguments with justifications should receive higher scores (6-10)
        ${consecutiveCount >= 3 ? "4. CRITICAL: Apply consecutive message penalty to scores" : ""}
        
        ASSESSMENT CRITERIA:
        1. SUBSTANCE: Does the message offer substantiated claims with reasoning/evidence?
        2. DEPTH: Does the message show depth of thought beyond simple assertions?
        3. NUANCE: Does the message acknowledge complexity or alternative viewpoints?
        4. CLARITY: Is reasoning clearly articulated and understandable?
        5. QUALITY: Overall contribution value to meaningful dialogue
        
        MESSAGE ID: ${message.id}
        
        In your analysis:
        - Focus on the quality and substance of the current message
        - Evaluate how well claims are supported with reasoning
        - Consider message clarity and contribution to dialogue${consecutiveWarning}
        
        Provide feedback that emphasizes:
        - Reasoning quality
        - Evidence/support for claims
        - Contribution to meaningful dialogue
        ${consecutiveCount >= 2 ? "- Message pacing and interaction balance" : ""}
      `;
      console.log("Requesting AI analysis...");
      // Get analysis and ensure all fields are present
      const analysis = await InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            message_id: { type: "string" },
            detected_biases: {
              type: "array",
              items: { type: "string" }
            },
            consistency_issues: {
              type: "array", 
              items: { type: "string" }
            },
            feedback: { type: "string" },
            improvement_tips: { type: "string" },
            scores: {
              type: "object",
              properties: {
                empathy: { type: "integer" },
                clarity: { type: "integer" },
                open_mindedness: { type: "integer" }
              }
            },
            score_explanation: {
              type: "object",
              properties: {
                empathy: { type: "string" },
                clarity: { type: "string" },
                open_mindedness: { type: "string" }
              }
            }
          },
          required: ["feedback", "improvement_tips", "scores"]
        }
      });

      console.log("Received AI analysis:", analysis);

      // Ensure we have all required fields
      if (!analysis.feedback || !analysis.improvement_tips) {
        throw new Error("AI analysis missing required feedback text");
      }

      // Create the complete analysis data object
      const analysisData = {
        score_change: analysis.scores,
        biases_detected: analysis.detected_biases || [],
        consistency_issues: analysis.consistency_issues || [],
        analysis_feedback: analysis.feedback,
        analysis_tips: analysis.improvement_tips,
        score_explanation: analysis.score_explanation || {}
      };

      console.log("Updating message with analysis data:", analysisData);

      // Update the message with ALL analysis data
      const updatedMessage = await Message.update(message.id, {
        ...message,  // Keep existing message data
        ...analysisData  // Add all analysis data
      });

      console.log("Message updated successfully:", updatedMessage);

      // Update local state with the complete message data
      setMessages(prev => prev.map(msg => 
        msg.id === message.id ? {
          ...msg,
          ...analysisData,
          analysis_feedback: analysis.feedback,    // Explicitly include
          analysis_tips: analysis.improvement_tips // these fields
        } : msg
      ));
      
      // Update conversation scores
      const scoreField = conversation.participant1_id === userId
        ? "participant1_score"
        : "participant2_score";
      
      const currentScore = conversation[scoreField] || {
        empathy: 0,
        clarity: 0,
        open_mindedness: 0,
        total: 0
      };
      
      const newScore = {
        empathy: currentScore.empathy + analysis.scores.empathy,
        clarity: currentScore.clarity + analysis.scores.clarity,
        open_mindedness: currentScore.open_mindedness + analysis.scores.open_mindedness,
        total: currentScore.total + (
          analysis.scores.empathy + 
          analysis.scores.clarity + 
          analysis.scores.open_mindedness
        )
      };

      // Update conversation with new scores
      const updatedConversation = await Conversation.update(conversation.id, {
        [scoreField]: newScore
      });

      // Update local state
      setConversation(updatedConversation);
      
      // Update user profile with new points
      if (userProfile) {
        const pointsGained = analysis.scores.empathy + analysis.scores.clarity + analysis.scores.open_mindedness;
        const newTotalPoints = (userProfile.total_points || 0) + pointsGained;
        const newLevel = Math.floor(newTotalPoints / 100) + 1;
        
        // Update highest scores if new scores are higher
        const highestScores = userProfile.highest_scores || {
          empathy: 0,
          clarity: 0,
          open_mindedness: 0
        };
        
        const newHighestScores = {
          empathy: Math.max(highestScores.empathy, analysis.scores.empathy),
          clarity: Math.max(highestScores.clarity, analysis.scores.clarity),
          open_mindedness: Math.max(highestScores.open_mindedness, analysis.scores.open_mindedness)
        };
        
        // Check if user leveled up
        const leveledUp = newLevel > (userProfile.level || 1);
        
        // Update profile
        const updatedProfile = await UserProfile.update(userProfile.id, {
          total_points: newTotalPoints,
          level: newLevel,
          highest_scores: newHighestScores
        });
        
        setUserProfile(updatedProfile);
        
        // Show level up toast if needed
        if (leveledUp) {
          showToast(
            "Level Up!",
            `Congratulations! You're now level ${newLevel}!`,
            "default",
            <Award className="h-6 w-6 text-yellow-500" />
          );
        }
      }
    } catch (error) {
      console.error("Error in sendMessage:", error);
      showToast("Error processing message", "Please try again", "destructive");
    }
    
    setIsSending(false);
    setIsWaiting(false);
  };

  // Update the consecutive message counter to handle responses properly
  const getConsecutiveMessageCount = (userId, messages) => {
    let count = 0;
    let foundResponse = false;
    
    // Start from the most recent message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      
      if (msg.sender_id === userId && !foundResponse) {
        count++;
      } else if (msg.sender_id !== "system" && msg.sender_id !== userId) {
        // Found a response from other user, stop counting
        foundResponse = true;
        break;
      }
    }
    
    return count;
  };

  // Modified function to fully load message analysis
  const loadMessageWithAnalysis = async (messageId) => {
    try {
      setIsPolling(false);
      console.log(`Loading fresh analysis data for message: ${messageId}`);
      
      // Get fresh message data
      const message = await Message.get(messageId);
      console.log("Loaded message data:", message);
      
      if (!message) {
        console.error(`Message ${messageId} not found`);
        return null;
      }

      // Ensure all analysis fields are present
      const completeMessage = {
        ...message,
        score_change: message.score_change || {
          empathy: 0,
          clarity: 0,
          open_mindedness: 0
        },
        biases_detected: message.biases_detected || [],
        consistency_issues: message.consistency_issues || [],
        analysis_feedback: message.analysis_feedback || "",
        analysis_tips: message.analysis_tips || "",
        score_explanation: message.score_explanation || {}
      };

      console.log("Processed message with complete analysis:", completeMessage);
      return completeMessage;
    } catch (error) {
      console.error("Error loading message analysis:", error);
      return null;
    }
  };

  // When clicking a message to show analysis
  const handleMessageClick = async (messageId) => {
    if (analysisShownForMessage === messageId) {
      setAnalysisShownForMessage(null);
      return;
    }
    
    setIsWaiting(true);
    try {
      // Always load fresh data when showing analysis
      const freshData = await loadMessageWithAnalysis(messageId);
      
      if (freshData) {
        console.log("Loaded fresh analysis data:", {
          id: freshData.id,
          feedback: freshData.analysis_feedback,
          tips: freshData.analysis_tips,
          biases: freshData.biases_detected,
          score_change: freshData.score_change
        });
        
        // Update the messages array with fresh data
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? freshData : msg
        ));
        setAnalysisShownForMessage(messageId);
      } else {
        showToast(
          "Error loading analysis",
          "Could not load message analysis",
          "destructive"
        );
      }
    } catch (error) {
      console.error("Error loading message analysis:", error);
      showToast(
        "Error loading analysis",
        "Please try again",
        "destructive"
      );
    }
    setIsWaiting(false);
  };

  // Add language hook at component level, not inside the renderAICoachMessage function
  const { currentLanguage, direction, t } = useLanguage();

  // AI Coach Message Display Component
  const renderAICoachMessage = (message) => {
    // Define language-specific content
    const content = {
      en: {
        analysisTitle: "AI Coach Analysis",
        biasesLabel: "Biases detected:",
        noBiases: "None detected",
        tipsLabel: "Tips for improvement:",
        noAnalysis: "No detailed analysis available for this message.",
        noTips: "No improvement tips available.",
        scoreLabels: {
          empathy: "Empathy",
          clarity: "Clarity",
          open_mindedness: "Open Mindedness"
        }
      },
      he: {
        analysisTitle: "ניתוח מאמן בינה מלאכותית",
        biasesLabel: "הטיות שזוהו:",
        noBiases: "לא זוהו הטיות",
        tipsLabel: "טיפים לשיפור:",
        noAnalysis: "אין ניתוח מפורט זמין להודעה זו.",
        noTips: "אין טיפים לשיפור זמינים.",
        scoreLabels: {
          empathy: "אמפתיה",
          clarity: "בהירות",
          open_mindedness: "פתיחות מחשבתית"
        }
      },
      ar: {
        analysisTitle: "تحليل مدرب الذكاء الاصطناعي",
        biasesLabel: "التحيزات المكتشفة:",
        noBiases: "لم يتم اكتشاف أي تحيزات",
        tipsLabel: "نصائح للتحسين:",
        noAnalysis: "لا يوجد تحليل مفصل متاح لهذه الرسالة.",
        noTips: "لا توجد نصائح تحسين متاحة.",
        scoreLabels: {
          empathy: "التعاطف",
          clarity: "الوضوح",
          open_mindedness: "العقل المنفتح"
        }
      }
    };
    
    // Select content based on current language, fallback to English
    const selectedContent = content[currentLanguage] || content.en;
    
    return (
      <div className={`mt-2 mb-4 mx-2 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 space-y-3">
            <div className={`flex items-center gap-2 text-purple-800 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <Brain className="h-4 w-4" />
              <span className="font-medium">{selectedContent.analysisTitle}</span>
            </div>
            
            {/* Score breakdown */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              {Object.entries(message.score_change || {}).map(([category, score]) => (
                <div key={category} className="bg-white rounded-lg p-2 text-center">
                  <div className="font-medium text-purple-800">+{score}</div>
                  <div className="text-xs text-gray-600 capitalize">
                    {selectedContent.scoreLabels[category] || category.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>

            {/* Biases detected */}
            <div>
              <div className="text-sm font-medium text-purple-800 mb-1">
                {selectedContent.biasesLabel}
              </div>
              <div className="flex flex-wrap gap-1">
                {message.biases_detected && message.biases_detected.length > 0 ? (
                  message.biases_detected.map((bias, i) => (
                    <Badge 
                      key={i}
                      variant="outline" 
                      className="bg-red-50 text-red-800 border-red-200"
                    >
                      {bias}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                    {selectedContent.noBiases}
                  </Badge>
                )}
              </div>
            </div>

            {/* Main feedback text */}
            <div className="bg-white rounded-lg p-3 text-sm text-gray-700">
              {message.analysis_feedback || selectedContent.noAnalysis}
            </div>

            {/* Improvement tips */}
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm font-medium text-purple-800 mb-1">
                {selectedContent.tipsLabel}
              </div>
              <div className="text-sm text-gray-700">
                {message.analysis_tips || selectedContent.noTips}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Ensure analysis data is rendered correctly in the message
  const renderAnalysis = (message) => {
    console.log("Rendering analysis for message:", {
      id: message.id,
      feedback: message.analysis_feedback,
      tips: message.analysis_tips
    });

    return (
      <div className="mt-2 mb-4 mx-2">
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-800">
              <Brain className="h-4 w-4" />
              <span className="font-medium">AI Coach Analysis</span>
            </div>
            
            {/* Score breakdown */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              {Object.entries(message.score_change || {}).map(([category, score]) => (
                <div key={category} className="bg-white rounded-lg p-2 text-center">
                  <div className="font-medium text-purple-800">+{score}</div>
                  <div className="text-xs text-gray-600 capitalize">
                    {category.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>

            {/* Biases detected */}
            <div>
              <div className="text-sm font-medium text-purple-800 mb-1">
                Biases detected:
              </div>
              <div className="flex flex-wrap gap-1">
                {message.biases_detected && message.biases_detected.length > 0 ? (
                  message.biases_detected.map((bias, i) => (
                    <Badge 
                      key={i}
                      variant="outline" 
                      className="bg-red-50 text-red-800 border-red-200"
                    >
                      {bias}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                    None detected
                  </Badge>
                )}
              </div>
            </div>

            {/* Main feedback text */}
            <div className="bg-white rounded-lg p-3 text-sm text-gray-700">
              {message.analysis_feedback || "No detailed analysis available for this message."}
            </div>

            {/* Improvement tips */}
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm font-medium text-purple-800 mb-1">
                Tips for improvement:
              </div>
              <div className="text-sm text-gray-700">
                {message.analysis_tips || "No improvement tips available."}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const otherParticipant = userProfiles[getOtherParticipantId()];
  const userScore = getUserScore() || { empathy: 0, clarity: 0, open_mindedness: 0, total: 0 };

  

  const [originalTitle] = useState(document.title);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageTimestamp = useRef(null);

  // Add language hook near the top with other hooks
  //const { t, direction } = useLanguage();

  // Update title with unread count
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) New Message${unreadCount > 1 ? 's' : ''} - MindfulChat`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [unreadCount, originalTitle]);

  // Handle new messages and unread count
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      // Only increment unread count if:
      // 1. Message is from the other participant
      // 2. User is not at bottom of chat
      // 3. Message is newer than last checked
      if (
        latestMessage.sender_id !== userId && 
        !shouldScrollToBottom &&
        (!lastMessageTimestamp.current || 
         new Date(latestMessage.sent_at) > lastMessageTimestamp.current)
      ) {
        setUnreadCount(prev => prev + 1);
      }
      
      lastMessageTimestamp.current = new Date(latestMessage.sent_at);
    }
  }, [messages, userId, shouldScrollToBottom]);

  // Reset unread count when user scrolls to bottom
  useEffect(() => {
    if (shouldScrollToBottom) {
      setUnreadCount(0);
    }
  }, [shouldScrollToBottom]);

  // Reset unread count when user opens/focuses the window
  useEffect(() => {
    const handleFocus = () => {
      if (shouldScrollToBottom) {
        setUnreadCount(0);
      }
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [shouldScrollToBottom]);

  // Reset title when component unmounts
  useEffect(() => {
    return () => {
      document.title = originalTitle;
    };
  }, [originalTitle]);

  const topics = {
    [topic?.id]: topic, // Example: Use the topic ID as the key and the topic object as the value
  };

  // Add indicator for when timer gets close to expiry
  const getTimerStatusClass = (timeRemaining) => {
    if (!timeRemaining) return '';
    
    if (timeRemaining < 300000) { // Less than 5 minutes
      return 'bg-red-50 text-red-700 animate-pulse';
    } else if (timeRemaining < 3600000) { // Less than 1 hour
      return 'bg-yellow-50 text-yellow-700';
    } else {
      return 'bg-blue-50 text-blue-700';
    }
  };

  // Ensure profiles are loaded after conversation is set
  useEffect(() => {
    if (conversation) {
      console.log("Conversation loaded, loading profiles now");
      loadUserProfiles();
      
      // Add check after a delay to catch any missing profiles
      setTimeout(async () => {
        const participantIds = [
          conversation.participant1_id,
          conversation.participant2_id
        ].filter(Boolean);
        
        let needsReload = false;
        for (const pid of participantIds) {
          if (!userProfiles[pid]) {
            needsReload = true;
            break;
          }
        }
        
        if (needsReload) {
          console.log("Some profiles still missing after delay, reloading...");
          await loadUserProfiles();
        }
      }, 1000);
    }
  }, [conversation]);

  const [showCompletionSummary, setShowCompletionSummary] = useState(false);

  const handleConversationComplete = async (completedConversation) => {
    setIsLoading(true);
    
    try {
      const currentUser = await User.me();
      
      // Award points for completing conversation
      await awardPointsToUser(currentUser.id, 10, 'conversation_complete');
      
      // Update conversation in state
      setConversation(completedConversation);
      
    } catch (error) {
      console.error("Error handling conversation completion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header section */}
      <div className="bg-white border-b py-2 px-3">
        <div className="flex flex-col gap-2">
          {/* First row with back button and title */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Conversations"))}
              className="flex-shrink-0"
            >
              {direction === 'rtl' ? (
                <ArrowRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
            
            <div className="flex-1 min-w-0 max-w-[60%]">
              <h1 className="text-base font-semibold text-gray-900 truncate">
                <span className="hidden sm:inline">{topic?.title || t('loading')}</span>
                <span className="sm:hidden">
                  {topic?.title 
                    ? (topic.title.length > 16
                        ? topic.title.substring(0, 16) + "..." 
                        : topic.title)
                    : t('loading')}
                </span>
              </h1>
            </div>

            {/* Status badge */}
            {conversation?.status && (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {t(conversation.status)}
              </Badge>
            )}
        </div>

        {/* Second row with timer and participant - with null checks */}
        <div className="flex items-center justify-between gap-2 px-1">
          {/* Timer - only show when timeRemaining is available */}
          {timeRemaining !== null && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              getTimerStatusClass(timeRemaining)
            }`}>
              <Clock className="h-3 w-3" />
              <span>{formatTimeRemaining(timeRemaining)}</span>
            </div>
          )}

          {/* Participant section with proper null handling */}
          <div className="flex items-center gap-1">
            {conversation && !isObserver && (
              <>
                {/* Other participant with fallback */}
                <div className="flex items-center">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ 
                      backgroundColor: getSafeProfile(getOtherParticipantId())?.avatar_color || getRandomColor() 
                    }}
                  >
                    {getSafeProfile(getOtherParticipantId())?.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  {participantOpinions[getOtherParticipantId()] && (
                    <Badge 
                      variant="outline" 
                      className="ml-1 text-xs"
                    >
                      {formatStance(participantOpinions[getOtherParticipantId()]?.stance)}
                    </Badge>
                  )}
                </div>
              </>
            )}
            
            {conversation && isObserver && (
              <div className="flex -space-x-2">
                {[conversation.participant1_id, conversation.participant2_id]
                  .filter(Boolean)
                  .map((pid) => (
                    <div 
                      key={pid} 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ 
                        backgroundColor: getSafeProfile(pid)?.avatar_color || getRandomColor() 
                      }}
                    >
                      {getSafeProfile(pid)?.display_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Score Bar */}
      {conversation?.status !== "waiting" && (
        <div className="bg-blue-50 px-4 py-2">
          <div className="max-w-5xl mx-auto">
            {/* Mobile view */}
            <div className="lg:hidden space-y-2">
              <div className="text-sm text-blue-800 flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span>{t('chat_conversation_level')}: <strong>{userScore.total}</strong></span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{t('chat_empathy')}</span>
                    <span className="text-xs">{userScore.empathy}</span>
                  </div>
                  <Progress value={userScore.empathy * 10} className="h-1.5 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{t('chat_clarity')}</span>
                    <span className="text-xs">{userScore.clarity}</span>
                  </div>
                  <Progress value={userScore.clarity * 10} className="h-1.5 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{t('chat_open_mind')}</span>
                    <span className="text-xs">{userScore.open_mindedness}</span>
                  </div>
                  <Progress value={userScore.open_mindedness * 10} className="h-1.5 bg-blue-200" />
                </div>
              </div>
            </div>

            {/* Desktop view */}
            <div className="hidden lg:flex items-center">
              <div className="text-sm text-blue-800 flex items-center gap-1 mr-4">
                <Award className="h-4 w-4" />
                <span>{t('chat_conversation_level')}: <strong>{userScore.total}</strong></span>
              </div>
              
              <div className="flex-1 grid grid-cols-3 gap-8">
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{t('chat_empathy')}</span>
                    <span>{userScore.empathy}</span>
                  </div>
                  <Progress value={userScore.empathy * 10} className="h-2 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{t('chat_clarity')}</span>
                    <span>{userScore.clarity}</span>
                  </div>
                  <Progress value={userScore.clarity * 10} className="h-2 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{t('chat_open_mind')}</span>
                    <span>{userScore.open_mindedness}</span>
                  </div>
                  <Progress value={userScore.open_mindedness * 10} className="h-2 bg-blue-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invitation Waiting Banner - NEW */}
      {conversation?.status === "invited" && conversation?.participant1_id === userId && (
        <div className="bg-purple-50 px-4 py-3 border-b border-purple-200">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <div className="animate-pulse rounded-full h-3 w-3 bg-purple-500"></div>
            <div className="flex-1">
              <h3 className="font-medium text-purple-800">{t('chat_invitation_sent')}</h3>
              <p className="text-sm text-purple-600">
                {t('chat_waiting_for_partner')}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(createPageUrl("Conversations"))}
              className="border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              {t('chat_back_conversations')}
            </Button>
          </div>
        </div>
      )}

      {/* Main Chat Area - Centered with max width */}
      <div className="flex-1 overflow-y-auto bg-gray-50" ref={chatContainerRef}>
        <div className="max-w-4xl mx-auto">
          {/* Messages */}
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : conversation?.status === "rejected" ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <X className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">{t('chat_invitation_declined')}</h3>
                <p className="text-gray-600 max-w-sm">
                  {userProfiles[getOtherParticipantId()]?.display_name || t('unknown_participant')} {t('has')} 
                  {t('declined your invitation to discuss')} "{topics[conversation.topic_id]?.title || t('this topic')}".
                </p>
                <div className="mt-6">
                  <Button
                    onClick={() => navigate(createPageUrl("FindPartners"))}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Users className="h-5 w-5 mr-2" />
                    {t('Find Other Partners')}
                  </Button>
                </div>
              </div>
            ) : conversation?.status === "invited" && conversation?.participant1_id === userId ? (
        <div className="flex flex-col items-center justify-center h-64 text-center p-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            {t('invitation_pending_title')}
          </h3>
          <p className="text-gray-600 max-w-sm" dir={direction}>
            {t('invitation_pending_desc', { topic: topic?.title || t('this_topic') })}
          </p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500 mr-2 animate-pulse"></span>
            {t('waiting_for_response')}
          </div>
        </div>
      ) : null}
            { messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-12 w-12 text-gray-300 mb-2" />
                {/* Check conversation status for empty state message */}
                {conversation?.status === "invited" ? (
                  <p className="text-gray-600">{t('waiting_for_response')}</p>
                ) : (
                  <p className="text-gray-600">{t('chat_no_messages')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isUser = message.sender_id === userId;
                  const showAnalysis = analysisShownForMessage === message.id;
                  const profile = getSafeProfile(message.sender_id);
                  
                  return (
                    <div key={message.id}>
                      <div 
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                        onClick={() => handleMessageClick(message.id)}
                      >
                        <div className={`
                          max-w-[80%] px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 relative
                          ${isUser ? 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}
                          ${showAnalysis ? 'ring-2 ring-purple-300' : ''}
                        `}>
                          {/* Message sender with fallback */}
                          {!isUser && message.message_type !== "system" && (
                            <div className="flex items-center mb-1">
                              {/* Avatar with fallback */}
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2"
                                style={{ backgroundColor: profile?.avatar_color || getRandomColor() }}
                              >
                                {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              {/* Name with fallback */}
                              <span className="text-sm font-medium text-gray-700">
                                {profile?.display_name || "Unknown"}
                              </span>
                            </div>
                          )}

                          {/* For system messages, show AI Coach icon */}
                          {message.message_type === "system" && (
                            <div className="flex items-center mb-1">
                              <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center mr-1">
                                <Brain className="w-3 h-3 text-purple-600" />
                              </div>
                              <span className="text-xs font-medium text-purple-700">
                                AI Coach
                              </span>
                            </div>
                          )}
                          
                          {/* Message content */}
                          <div className="text-sm whitespace-pre-line">
                            {message.content}
                          </div>
                          
                          {/* Message footer */}
                          <div className="flex justify-between items-center mt-1">
                            <div className={`text-xs ${isUser ? 'text-indigo-700' : 'text-gray-500'}`}>
                              {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            
                            {/* Score indicator */}
                            {message.message_type !== "system" && message.score_change && (
                              <div className={`text-xs font-medium flex items-center ml-2 ${
                                isUser ? 'text-green-700' : 'text-blue-700'
                              }`}>
                                <Award className="h-3 w-3 mr-0.5" />
                                +{Object.values(message.score_change).reduce((a, b) => a + b, 0)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Analysis panel */}
                      {showAnalysis && renderAICoachMessage(message)}
                    </div>
                  );
                })}
                
                {isWaiting && (
                  <div className="flex justify-center">
                    <div className="bg-purple-100 text-purple-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                        <span>AI Coach is analyzing your message...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messageEndRef} />
              </div>
            )}
          </div>
          
          {/* Show completion feedback at the end of completed conversations */}
          {conversation?.status === "completed" && conversation.completion_feedback && (
            <div className="space-y-4 p-4 bg-gray-50">
              <div className="text-center text-gray-600 font-medium">
                {t('chat_final_thoughts')}
              </div>
              {conversation.completion_feedback.map((feedback, index) => {
                // Determine if this feedback is from the current user
                const isCurrentUser = feedback.user_id === userId;
                const profile = isCurrentUser ? userProfile : userProfiles[feedback.user_id];
                
                return (
                  <Card key={index} className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar 
                          user={profile}
                          size="xs"
                        />
                        <span className="font-medium ml-1">
                          {isCurrentUser ? 
                            (userProfile?.display_name || "You") : 
                            (profile?.display_name || "Unknown participant")}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(feedback.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-line">{feedback.feedback}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New message indicator */}
      {hasNewMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2">
          <Button 
            onClick={scrollToBottom} 
            size="sm" 
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-full px-4"
          >
            <ChevronDown className="h-4 w-4" />
            <span>{t('chat_new_message')}</span>
          </Button>
        </div>
      )}

      {/* Invitation Accept/Reject UI - keep this */}
      {conversation?.status === "invited" && conversation?.participant2_id === userId && (
        <div className="bg-purple-50 px-4 py-3 border-b p-4">
          <div className="flex flex-col items-center gap-3 mb-3">
            <div className="flex items-center gap-2 text-purple-800">
              <Users className="h-5 w-5" />
              <p>{t('chat_invited_to_discuss')} <strong>{topic?.title}</strong></p>
            </div>
            <p className="text-sm text-gray-600 text-center">
              {userProfiles[conversation.participant1_id]?.display_name || t('Someone')} {t('would like to talk about this topic with you')}
            </p>
            
            {/* Timer information is now more prominent */}
            <div className="flex items-center gap-2 bg-purple-100 px-4 py-3 rounded-lg text-purple-800 mt-1 w-full">
              <Clock className="h-5 w-5" />
              <div>
                <p className="font-medium">{t('chat_time_limited')}</p>
                <p className="text-sm">
                  {t('chat_will_complete')}{' '}
                  <strong>{formatTimeRemaining(timeRemaining)}</strong>
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRejectInvitation}
              disabled={isAccepting}
            >
              {t('chat_decline')}
            </Button>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleAcceptInvitation}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : null}
              {t('chat_accept_invitation')}
            </Button>
          </div>
        </div>
      )}
      
      {/* Hide message input for invited conversations where user is initiator */}
      {conversation?.status === "invited" && conversation?.participant1_id === userId && (
        <div className="bg-white border-t p-4">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Clock className="h-5 w-5 text-purple-500" />
            <p>{t('chat_waiting_for_partner')}</p>
          </div>
        </div>
      )}

      {/* Message Input - Active Conversation */}
      
      {/* Completed/Abandoned State */}
      {(conversation?.status === "completed" || conversation?.status === "abandoned") && (
        <div className="bg-gray-50 border-t p-4">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <CheckCircle2 className="h-5 w-5" />
            <p>{t('chat_conversation_completed')}</p>
          </div>
        </div>
      )}

      {/* Hide message input for rejected conversations */}
      {conversation?.status === "rejected" && (
        <div className="bg-gray-50 border-t p-4">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <X className="h-5 w-5" />
            <p>{t('chat_conversation_declined')}</p>
          </div>
        </div>
      )}

      {/* Show appropriate completion UI based on status */}
      {conversation?.status === "waiting_completion" && !hasUserCompleted(userId) && (
        <div className="bg-yellow-50 border-t p-4">
          <div className="flex items-center justify-center gap-2 text-yellow-800 mb-4">
            <Clock className="h-5 w-5" />
            <p>{t('chat_other_shared_thoughts')}</p>
          </div>
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setShowCompletionDialog(true)}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            {t('chat_share_thoughts')}
          </Button>
        </div>
      )}

      {/* Message input section - Hide if waiting for completion or completed */}
      {conversation?.status === "active" && (
        <div className="bg-white border-t p-3 pb-safe">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim() && !isSending && !isWaiting) {
                    sendMessage();
                  }
                }
              }}
              placeholder={t('chat_type_message')}
              className="min-h-[50px] resize-none"
              disabled={isSending || isWaiting}
            />
            <div className="self-end flex gap-2">
              <Button
                variant="outline"
                className="self-end"
                onClick={() => setShowCompletionDialog(true)}
              >
                <CheckCircle2 className="h-5 w-5" />
              </Button>
              <Button
                className="self-end bg-indigo-600 hover:bg-indigo-700"
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending || isWaiting}
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completion state indicator */}
      {conversation?.status === "waiting_completion" && hasUserCompleted(userId) && (
        <div className="bg-yellow-50 border-t p-4">
          <div className="flex items-center justify-center gap-2 text-yellow-800">
            <Clock className="h-5 w-5" />
            <p>{t('chat_waiting_completion')}</p>
          </div>
        </div>
      )}

      {/* Completed state */}
      {conversation?.status === "completed" && (
        <div className="bg-green-50 border-t p-4">
          <div className="flex items-center justify-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <p>{t('chat_conversation_completed_status')}</p>
          </div>
        </div>
      )}
      
      {/* Show completion request UI for non-requesting user */}
      {conversation?.status === "completion_requested" && !isCompletionRequester() && (
        <div className="bg-yellow-50 border-t p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Clock className="h-5 w-5" />
              <p>{t('chat_end_request')}</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRejectCompletion}
              >
                {t('chat_keep_discussing')}
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setShowCompletionDialog(true)}
              >
                {t('chat_accept_complete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show waiting state for requesting user */}
      {conversation?.status === "completion_requested" && isCompletionRequester() && (
        <div className="bg-yellow-50 border-t p-4">
          <div className="flex items-center justify-center gap-2 text-yellow-800">
            <Clock className="h-5 w-5" />
            <p>{t('chat_waiting_accept')}</p>
          </div>
        </div>
      )}

      {/* Modified CompletionDialog component will use its own translations */}

      {/* Waiting State - First message UI */}
      {conversation?.status === "waiting" && (
        <div className="bg-yellow-50 border-t p-4">
          <div className="flex items-center gap-3 text-yellow-800 mb-3">
            <Clock className="h-5 w-5" />
            <p>{t('Waiting for you to start the conversation...')}</p>
          </div>
          <div>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim() && !isSending) {
                    sendMessage();
                  }
                }
              }}
              placeholder={t('chat_type_message')}
              className="min-h-[60px] resize-none"
              disabled={isSending}
            />
            <Button
              className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              {t('chat_start_conversation')}
            </Button>
          </div>
        </div>
      )}

      {/* Score Bar */}
      {conversation?.status !== "waiting" && (
        <div className="bg-blue-50 px-4 py-2">
          <div className="max-w-5xl mx-auto">
            {/* Mobile view */}
            <div className="lg:hidden space-y-2">
              <div className="text-sm text-blue-800 flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span>{t('chat_conversation_level')}: <strong>{userScore.total}</strong></span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{t('chat_empathy')}</span>
                    <span className="text-xs">{userScore.empathy}</span>
                  </div>
                  <Progress value={userScore.empathy * 10} className="h-1.5 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{t('chat_clarity')}</span>
                    <span className="text-xs">{userScore.clarity}</span>
                  </div>
                  <Progress value={userScore.clarity * 10} className="h-1.5 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{t('chat_open_mind')}</span>
                    <span className="text-xs">{userScore.open_mindedness}</span>
                  </div>
                  <Progress value={userScore.open_mindedness * 10} className="h-1.5 bg-blue-200" />
                </div>
              </div>
            </div>

            {/* Desktop view */}
            <div className="hidden lg:flex items-center">
              <div className="text-sm text-blue-800 flex items-center gap-1 mr-4">
                <Award className="h-4 w-4" />
                <span>{t('chat_conversation_level')}: <strong>{userScore.total}</strong></span>
              </div>
              
              <div className="flex-1 grid grid-cols-3 gap-8">
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{t('chat_empathy')}</span>
                    <span>{userScore.empathy}</span>
                  </div>
                  <Progress value={userScore.empathy * 10} className="h-2 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{t('chat_clarity')}</span>
                    <span>{userScore.clarity}</span>
                  </div>
                  <Progress value={userScore.clarity * 10} className="h-2 bg-blue-200" />
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{t('chat_open_mind')}</span>
                    <span>{userScore.open_mindedness}</span>
                  </div>
                  <Progress value={userScore.open_mindedness * 10} className="h-2 bg-blue-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
