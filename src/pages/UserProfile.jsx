
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Award,
  MessageCircle,
  Users,
  Brain,
  Lightbulb,
  Trophy,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Heart,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import { delay } from "../components/utils/apiHelpers";

// Badge definitions moved to a constant
const BADGE_DEFINITIONS = {
  newcomer: {
    name: "Newcomer",
    description: "Joined the conversation",
    icon: <Users className="h-6 w-6 text-blue-500" />,
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  first_conversation: {
    name: "First Chat",
    description: "Completed first conversation",
    icon: <MessageCircle className="h-6 w-6 text-green-500" />,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  empathy_master: {
    name: "Empathy Master",
    description: "High empathy scores",
    icon: <Brain className="h-6 w-6 text-pink-500" />,
    color: "bg-pink-100 text-pink-800 border-pink-200"
  },
  clarity_champion: {
    name: "Clarity Champion",
    description: "Clear and effective communication",
    icon: <Lightbulb className="h-6 w-6 text-amber-500" />,
    color: "bg-amber-100 text-amber-800 border-amber-200"
  },
  // Add more badge definitions as needed
};

export default function UserProfilePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useAppToast();

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [opinions, setOpinions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [topics, setTopics] = useState({});
  const [error, setError] = useState(null);
  const [loadingStates, setLoadingStates] = useState({
    profile: true,
    opinions: true,
    conversations: true
  });
  const [userId, setUserId] = useState(searchParams.get("id"));

  useEffect(() => {
    const urlId = searchParams.get("id");
    console.log("UserProfile mounted with ID param:", {
      urlId,
      currentUserId: userId,
      timestamp: new Date().toISOString(),
      pathname: window.location.pathname
    });
    
    // Only redirect if we're actually on the UserProfile page
    // This prevents unwanted redirects when the component is unmounting during navigation
    if (!urlId && window.location.pathname.includes("UserProfile")) {
      console.warn("No user ID provided in URL params, redirecting");
      navigate(createPageUrl("Community"));
      return;
    }
    
    if (urlId) {
      setUserId(urlId);
      loadProfileData(urlId);
    }
  }, [searchParams]);

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const loadProfileData = async (profileId = userId) => {
    try {
      setError(null);
      
      // Try to load profile directly first
      try {
        console.log("Attempting to load profile with ID:", profileId);
        const profileData = await UserProfile.get(profileId);
        
        if (profileData) {
          console.log("Profile loaded successfully:", profileData);
          setProfile(profileData);
          setLoadingStates(prev => ({ ...prev, profile: false }));
          
          // IMPORTANT: Check for conversations with the correct user_id from the profile
          // NOT with the profile ID itself!
          if (profileData.user_id) {
            // Load opinions and conversations with the correct user_id
            await Promise.all([
              loadUserOpinions(profileData.user_id),
              loadUserConversations(profileData.user_id)
            ]);
          } else {
            console.error("Profile doesn't have user_id field:", profileData);
            setLoadingStates(prev => ({ 
              ...prev, 
              opinions: false,
              conversations: false 
            }));
          }
          
          return;
        }
      } catch (error) {
        console.error("Error loading profile directly:", error);
      }
      
      // If we got here, we couldn't load the profile directly
      // Try another approach - check if this is a User ID instead of Profile ID
      try {
        console.log("Attempting to find profile by user_id:", profileId);
        const profiles = await UserProfile.filter({ user_id: profileId });
        
        if (profiles && profiles.length > 0) {
          console.log("Found profile by user_id:", profiles[0]);
          setProfile(profiles[0]);
          setLoadingStates(prev => ({ ...prev, profile: false }));
          
          // Load related data
          await Promise.all([
            loadUserOpinions(profileId),
            loadUserConversations(profileId)
          ]);
          return;
        }
      } catch (error) {
        console.error("Error finding profile by user_id:", error);
      }
      
      // If we still don't have a profile, try one last approach - create a placeholder
      // But first check if this ID exists as a user at all
      try {
        // This will likely fail if it's not a valid user ID
        await User.filter({ id: profileId });
        
        console.log("Creating placeholder profile for user:", profileId);
        // Try to create a placeholder profile
        const randomColor = getRandomColor();
        const placeholderProfile = {
          user_id: profileId,
          display_name: "Community Member",
          bio: "No bio provided yet",
          avatar_color: randomColor,
          level: 1,
          total_points: 0,
          badges: ["newcomer"],
          conversations_completed: 0,
          highest_scores: {
            empathy: 0,
            clarity: 0,
            open_mindedness: 0
          }
        };
        
        await UserProfile.create(placeholderProfile);
        setProfile(placeholderProfile);
        setLoadingStates(prev => ({ ...prev, profile: false }));
        
        // Set empty data for other sections
        setLoadingStates({
          profile: false,
          opinions: false,
          conversations: false
        });
      } catch (error) {
        console.error("Final error creating placeholder profile:", error);
        setError("This user profile could not be found.");
        
        // Show a toast and update loading states
        showToast(
          "Profile not found",
          "The requested user profile doesn't exist",
          "destructive"
        );
      }
    } catch (error) {
      console.error("Error loading profile data:", error);
      setError("Error loading profile data. Please try again later.");
      showToast(
        "Error loading profile",
        "Please try again later",
        "destructive"
      );
    } finally {
      setIsLoading(false);
      setLoadingStates({
        profile: false,
        opinions: false,
        conversations: false
      });
    }
  };

  // Helper function for random colors
  const getRandomColor = () => {
    const colors = [
      "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E", 
      "#10B981", "#06B6D4", "#F59E0B", "#EF4444"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  const loadUserOpinions = async (userId) => {
    try {
      const userOpinions = await TopicOpinion.filter({ user_id: userId });
      setOpinions(userOpinions);

      // Load topics for these opinions
      const topicIds = [...new Set(userOpinions.map(op => op.topic_id))];
      const topicsMap = {};
      
      // Load topics one at a time with delays to prevent rate limiting
      for (const topicId of topicIds) {
        try {
          const topic = await Topic.get(topicId);
          topicsMap[topicId] = topic;
        } catch (error) {
          console.error(`Error loading topic ${topicId}:`, error);
          // Add fallback for missing topics
          topicsMap[topicId] = {
            id: topicId,
            title: "Topic Unavailable",
            description: "This topic is no longer available",
            category: "Unknown"
          };
        }
        await delay(300);
      }
      
      setTopics(topicsMap);
    } catch (error) {
      console.error("Error loading opinions:", error);
    }
    setLoadingStates(prev => ({ ...prev, opinions: false }));
  };
  
  const loadUserConversations = async (userId) => {
    console.log("Starting to load conversations for user:", userId);
    setLoadingStates(prev => ({ ...prev, conversations: true }));
    
    try {
      // Load all conversations first
      const allConversations = await Conversation.list();
      console.log(`Found ${allConversations.length} total conversations in system`);
      
      // Filter client-side to find this user's conversations
      const userConversations = allConversations.filter(conv => 
        conv.participant1_id === userId || 
        conv.participant2_id === userId
      );
      
      console.log(`Found ${userConversations.length} conversations for user ${userId}`);
      setConversations(userConversations);
      
      // Load topics for these conversations
      const topicIds = [...new Set(userConversations.map(conv => conv.topic_id))];
      const topicsMap = {};
      
      for (const topicId of topicIds) {
        try {
          const topic = await Topic.get(topicId);
          topicsMap[topicId] = topic;
        } catch (error) {
          console.error(`Error loading topic ${topicId}:`, error);
          // Add fallback for missing topics
          topicsMap[topicId] = {
            id: topicId,
            title: "Topic Unavailable",
            description: "This topic is no longer available",
            category: "Unknown"
          };
        }
        await delay(300); // Prevent rate limiting
      }
      
      setTopics(topicsMap);
    } catch (error) {
      console.error("Error loading conversations:", error);
      showToast(
        "Error loading conversations",
        "Please try again later",
        "destructive"
      );
    }
    
    setLoadingStates(prev => ({ ...prev, conversations: false }));
  };

  const formatStance = (stance) => {
    switch (stance) {
      case "strongly_agree":
        return "Strongly Agree";
      case "agree":
        return "Agree";
      case "neutral":
        return "Neutral";
      case "disagree":
        return "Disagree";
      case "strongly_disagree":
        return "Strongly Disagree";
      default:
        return stance;
    }
  };

  const getStanceIcon = (stance) => {
    switch (stance) {
      case "strongly_agree":
        return <ThumbsUp className="w-3 h-3 fill-emerald-500 stroke-emerald-600" />;
      case "agree":
        return <ThumbsUp className="w-3 h-3" />;
      case "neutral":
        return <Heart className="w-3 h-3" />;
      case "disagree":
        return <ThumbsDown className="w-3 h-3" />;
      case "strongly_disagree":
        return <ThumbsDown className="w-3 h-3 fill-red-500 stroke-red-600" />;
      default:
        return null;
    }
  };

  // Add a helper function to check if bio is meaningful
  const hasMeaningfulBio = (bio) => {
    return bio && bio.trim() !== "" && bio !== "No bio provided yet";
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Add error state UI
  if (error) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Community"))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
            <p className="text-gray-600">View member details and activity</p>
          </div>
        </header>

        <Card className="text-center p-8">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              onClick={() => navigate(createPageUrl("Community"))}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Return to Community
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Community"))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600">View member details and activity</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4"
                style={{ backgroundColor: profile?.avatar_color || "#6366f1" }}
              >
                {profile?.display_name?.charAt(0).toUpperCase()}
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900">
                {profile?.display_name}
              </h2>
              
              <div className="flex items-center gap-2 mt-2">
                <Award className="h-4 w-4 text-indigo-500" />
                <span className="text-gray-600">Level {profile?.level || 1}</span>
              </div>

              {hasMeaningfulBio(profile?.bio) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                  <p className="text-gray-600 italic">{profile.bio}</p>
                </div>
              )}

              <div className="w-full mt-6">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress to next level</span>
                  <span className="text-gray-600">
                    {profile?.total_points % 100}/100
                  </span>
                </div>
                <Progress value={profile?.total_points % 100} className="h-2" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 w-full mt-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {profile?.conversations_completed || 0}
                  </div>
                  <div className="text-sm text-gray-600">
                    Conversations
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {profile?.total_points || 0}
                  </div>
                  <div className="text-sm text-gray-600">
                    Total Points
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs defaultValue="opinions" className="space-y-6">
            <TabsList>
              <TabsTrigger value="opinions" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                <span>Opinions</span>
              </TabsTrigger>
              <TabsTrigger value="conversations" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>Conversations</span>
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span>Achievements</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opinions">
              {loadingStates.opinions ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : opinions.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">No opinions yet</h3>
                    <p className="text-gray-500 text-sm">
                      This user hasn't shared any opinions on topics
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {opinions.map(opinion => {
                    const topic = topics[opinion.topic_id];
                    return (
                      <Card key={opinion.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-medium">{topic?.title}</h3>
                            <Badge variant="outline">
                              {topic?.category}
                            </Badge>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Badge className="flex items-center gap-1">
                              {getStanceIcon(opinion.stance)}
                              {formatStance(opinion.stance)}
                            </Badge>
                            {opinion.willing_to_discuss && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Open to discuss
                              </Badge>
                            )}
                          </div>
                          {opinion.reasoning && (
                            <p className="mt-3 text-sm text-gray-600">
                              {opinion.reasoning}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="conversations">
              {loadingStates.conversations ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">No conversations yet</h3>
                    <p className="text-gray-500 text-sm mb-4">
                      This user hasn't participated in any discussions
                    </p>
                    
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {conversations.map(conv => {
                    const topic = topics[conv.topic_id];
                    const score = conv.participant1_id === profile.user_id
                      ? conv.participant1_score
                      : conv.participant2_score;
                    
                    return (
                      <Card 
                        key={conv.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`${createPageUrl("ChatView")}?id=${conv.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{topic?.title || "Unknown Topic"}</h3>
                            <Badge 
                              className={
                                conv.status === "completed" ? "bg-green-100 text-green-800" :
                                conv.status === "active" ? "bg-blue-100 text-blue-800" :
                                "bg-gray-100 text-gray-800"
                              }
                            >
                              {conv.status}
                            </Badge>
                          </div>
                          
                          {score && (
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                {score.total || 0} points
                              </Badge>
                              {Object.entries(score || {}).map(([category, value]) => {
                                if (category === "total") return null;
                                return (
                                  <Badge 
                                    key={category}
                                    variant="outline"
                                    className="capitalize"
                                  >
                                    {category}: {value || 0}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                          
                          {conv.started_at && (
                            <div className="mt-2 text-xs text-gray-500">
                              {new Date(conv.started_at).toLocaleDateString()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="achievements">
              {loadingStates.profile ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-16 bg-gray-200 rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !profile?.badges?.length ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">No achievements yet</h3>
                    <p className="text-gray-500 text-sm">
                      This user hasn't earned any badges
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.badges.map(badgeId => {
                    const badge = BADGE_DEFINITIONS[badgeId];
                    if (!badge) return null;
                    
                    return (
                      <Card key={badgeId} className={`border ${badge.color}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${badge.color}`}>
                              {badge.icon}
                            </div>
                            <div>
                              <h3 className="font-bold">{badge.name}</h3>
                              <p className="text-sm text-gray-600">{badge.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
