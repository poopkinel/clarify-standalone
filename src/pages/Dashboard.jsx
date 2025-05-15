
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Users,
  Trophy,
  ArrowRight,
  MessageCircle,
  Award,
  Zap,
  TrendingUp,
  Flame,
  Medal,
  Lightbulb
} from "lucide-react";
import TopicCard from "../components/topics/TopicCard";
import { useAppToast } from "@/components/utils/toast";
import { delay, retryWithBackoff, entityCache, useCache } from "../components/utils/apiHelpers";
import Avatar from "@/components/ui/avatar";

export default function Dashboard() {
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [topConversations, setTopConversations] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [topicStats, setTopicStats] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  
  // Add sectional loading states
  const [loadingStates, setLoadingStates] = useState({
    profile: true,
    topics: true,
    conversations: true,
    users: true,
    matches: true
  });
  
  // Add loading control
  const loadingRef = React.useRef(false);
  const lastLoadRef = React.useRef(0);

  const loadDashboardData = async () => {
    // Prevent concurrent loads and rate limiting
    if (loadingRef.current) return;
    
    // Check if we've loaded recently (within 30 seconds)
    const now = Date.now();
    if (now - lastLoadRef.current < 30000) {
      console.log("[Dashboard] Skipping load - loaded recently");
      return;
    }
    
    loadingRef.current = true;
    lastLoadRef.current = now;
    setIsLoading(true);
    
    try {
      console.log("[Dashboard] Starting data load");
      
      // First, check cache for topics
      const cachedTopics = localStorage.getItem('cachedTrendingTopics');
      const cacheExpiry = parseInt(localStorage.getItem('topicCacheExpiry') || '0');
      
      // Use cache if it's less than 5 minutes old
      if (cachedTopics && now - cacheExpiry < 300000) {
        try {
          const parsedTopics = JSON.parse(cachedTopics);
          setTrendingTopics(parsedTopics);
          setLoadingStates(prev => ({ ...prev, topics: false }));
          console.log("[Dashboard] Using cached topics");
          
          // Also initialize topicStats from cache
          const cachedStats = localStorage.getItem('cachedTopicStats');
          if (cachedStats) {
            setTopicStats(JSON.parse(cachedStats));
          }
        } catch (e) {
          console.error("Error parsing cached topics:", e);
        }
      } else {
        // If no valid cache, load topics with minimum needed fields
        try {
          console.log("[Dashboard] Loading topics (cache expired or missing)");
          let topicsData = await Topic.list("-created_date", 3);
          console.log("[Dashboard] Topics loaded:", topicsData.length);
          
          setTrendingTopics(topicsData);
          setLoadingStates(prev => ({ ...prev, topics: false }));
          
          // Cache the results
          localStorage.setItem('cachedTrendingTopics', JSON.stringify(topicsData));
          localStorage.setItem('topicCacheExpiry', now.toString());
        } catch (error) {
          console.error("[Dashboard] Error loading topics:", error);
          
          // Try to use older cached data even if expired
          try {
            if (cachedTopics) {
              setTrendingTopics(JSON.parse(cachedTopics));
              setLoadingStates(prev => ({ ...prev, topics: false }));
              console.log("[Dashboard] Using expired cached topics as fallback");
            }
          } catch (e) {
            console.error("Error using fallback cached topics:", e);
          }
        }
      }
      
      // Initialize basic stats for loaded topics
      const initialStats = {};
      trendingTopics.forEach(topic => {
        initialStats[topic.id] = {
          totalDiscussions: 0,
          activeDiscussions: 0,
          totalOpinions: 0,
          heatScore: 0,
          recentActivity: false
        };
      });
      setTopicStats(initialStats);
      
      // Stagger API requests to avoid rate limits
      await delay(500);
      
      // Load opinion counts, but only if we don't have cached stats or if force refresh
      const cachedStats = localStorage.getItem('cachedTopicStats');
      if (!cachedStats || now - cacheExpiry > 300000) {
        try {
          if (trendingTopics.length > 0) {
            console.log("[Dashboard] Loading opinion counts");
            
            // Use topic-specific filters instead of loading all opinions
            for (const topic of trendingTopics) {
              await delay(300); // Add delay between requests
              try {
                const topicOpinions = await TopicOpinion.filter({ topic_id: topic.id });
                
                setTopicStats(prev => {
                  const updated = { ...prev };
                  if (updated[topic.id]) {
                    updated[topic.id].totalOpinions = topicOpinions.length;
                  }
                  return updated;
                });
              } catch (error) {
                console.error(`[Dashboard] Error loading opinions for topic ${topic.id}:`, error);
              }
            }
            
            // Cache the stats
            localStorage.setItem('cachedTopicStats', JSON.stringify(topicStats));
          }
        } catch (error) {
          console.error("[Dashboard] Error loading opinions:", error);
          
          // Try to use cached stats as fallback
          if (cachedStats) {
            try {
              setTopicStats(JSON.parse(cachedStats));
              console.log("[Dashboard] Using cached topic stats as fallback");
            } catch (e) {
              console.error("Error parsing cached topic stats:", e);
            }
          }
        }
      } else if (cachedStats) {
        // Use cached stats
        setTopicStats(JSON.parse(cachedStats));
      }
      
      // Stagger API requests further
      await delay(500);
      
      // Conversation counts - load with limit to avoid rate limits
      try {
        console.log("[Dashboard] Loading limited conversation data");
        const conversations = await Conversation.list("-created_date", 10);
        
        // Process conversation stats
        const conversationStats = {};
        conversations.forEach(conv => {
          if (!conversationStats[conv.topic_id]) {
            conversationStats[conv.topic_id] = { total: 0, active: 0 };
          }
          conversationStats[conv.topic_id].total++;
          if (conv.status === "active") {
            conversationStats[conv.topic_id].active++;
          }
        });
        
        // Update topic stats with conversation counts
        setTopicStats(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(topicId => {
            if (conversationStats[topicId]) {
              updated[topicId].totalDiscussions = conversationStats[topicId].total;
              updated[topicId].activeDiscussions = conversationStats[topicId].active;
            }
          });
          return updated;
        });
        
        // Update cache
        localStorage.setItem('cachedTopicStats', JSON.stringify(topicStats));
      } catch (error) {
        console.error("[Dashboard] Error loading conversations:", error);
      }
      
      console.log("[Dashboard] Data load completed");
    } catch (error) {
      console.error("[Dashboard] Error in main loading function:", error);
      showToast("Error loading dashboard", "Some content may be unavailable", "destructive");
    } finally {
      // Always exit loading state
      setIsLoading(false);
      loadingRef.current = false;
      console.log("[Dashboard] Loading state finished");
    }
  };

  // Replace polling with a more efficient approach
  const refreshData = () => {
    // Only refresh if we haven't loaded recently
    const now = Date.now();
    if (now - lastLoadRef.current > 30000) {
      // Force clear caches
      localStorage.removeItem('topicCacheExpiry');
      loadDashboardData();
    } else {
      console.log("[Dashboard] Skipping refresh - loaded recently");
    }
  };

  // Use a more efficient loading approach with caching
  useEffect(() => {
    // Initial load
    loadDashboardData();
    
    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.log("[Dashboard] Safety timeout triggered - forcing loading to complete");
        setIsLoading(false);
        loadingRef.current = false;
      }
    }, 10000);
    
    // Use a less frequent polling interval
    const pollingInterval = setInterval(() => {
      const now = Date.now();
      // Only check every 2 minutes
      if (now - lastLoadRef.current > 120000) {
        refreshOpinionCounts();
      }
    }, 120000); // Check every 2 minutes
    
    return () => {
      clearTimeout(safetyTimeout);
      clearInterval(pollingInterval);
    };
  }, []);
  
  // Optimized function to just refresh opinion counts
  const refreshOpinionCounts = async () => {
    // Skip if already loading or loaded recently
    if (loadingRef.current || Date.now() - lastLoadRef.current < 60000) {
      return;
    }
    
    try {
      // Skip if no topics loaded
      if (trendingTopics.length === 0) return;
      
      console.log("[Dashboard] Refreshing opinion counts");
      
      // Only get counts for the first topic to minimize API calls
      if (trendingTopics[0]) {
        const topicId = trendingTopics[0].id;
        const topicOpinions = await TopicOpinion.filter({ topic_id: topicId });
        
        setTopicStats(prev => {
          const updated = { ...prev };
          if (updated[topicId]) {
            updated[topicId].totalOpinions = topicOpinions.length;
          }
          return updated;
        });
      }
      
      console.log("[Dashboard] Opinion counts refreshed for primary topic");
    } catch (error) {
      console.error("[Dashboard] Error refreshing opinion counts:", error);
    }
  };

  const TopicsSkeleton = () => (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="h-40 bg-gray-200"></div>
            <div className="p-4 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-16 bg-gray-100 rounded"></div>
                <div className="h-16 bg-gray-100 rounded"></div>
                <div className="h-16 bg-gray-100 rounded"></div>
              </div>
              <div className="h-10 bg-gray-200 rounded mt-4"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  const ConversationsSkeleton = () => (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm p-4">
            <div className="flex justify-between mb-3">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-20 bg-gray-100 rounded mt-4"></div>
          </div>
        ))}
      </div>
    </div>
  );
  
  const UsersSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="bg-white rounded-xl overflow-hidden shadow-sm p-4">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  const MatchesSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="bg-white rounded-xl overflow-hidden shadow-sm p-4">
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div>
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
        <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
      </div>
    </div>
  );

  if (isLoading && !trendingTopics.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            
            {/* Initial loading skeleton */}
            <div className="my-8 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300"></div>
              <p className="text-gray-600 mt-4">Loading your personalized dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectTopic = (topic) => {
    // Navigate to Topics page with dialog parameter to open the dialog for this topic
    navigate(`${createPageUrl("Topics")}?dialog=${topic.id}`);
  };

  return (
    <div className="space-y-8 px-0 sm:px-4">
      {/* Welcome Section with adjusted padding */}
      <header className="px-4 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Clarify</h1>
        <p className="text-gray-600 mt-1">
          Discover meaningful conversations and connect with others
        </p>
      </header>

      {/* Trending Topics Section */}
      <section className="px-4 sm:px-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Hot Topics
              <span className="text-sm text-gray-500 font-normal ml-1 hidden sm:inline">Most active discussions</span>
            </h2>
          </div>
          <Button 
            variant="ghost"
            onClick={() => navigate(createPageUrl("Topics"))}
            className="flex items-center gap-2"
          >
            View all topics
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {loadingStates.topics ? (
          <TopicsSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
            {trendingTopics.length > 0 ? (
              trendingTopics.map((topic, index) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  topicStats={topicStats[topic.id]}
                  onSelect={handleSelectTopic}
                  rank={index + 1}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">No hot topics found at the moment. Check back later!</p>
              </div>
            )}
          </div>
        )}
        
        {trendingTopics.length > 0 && (
          <div className="mt-6 text-center">
            <Button 
              variant="outline"
              onClick={() => navigate(createPageUrl("Topics"))}
              className="px-8"
            >
              Explore More Topics
            </Button>
          </div>
        )}
      </section>

      {/* Featured Discussions with enhanced design - simplified for now */}
      <section className="px-4 sm:px-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Featured Discussions
              <Badge className="bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 ml-2">Top Quality</Badge>
            </h2>
            <p className="text-sm text-gray-500 mt-1">Learn from our most insightful conversations</p>
          </div>
          <Button 
            variant="ghost"
            onClick={() => navigate(createPageUrl("TopConversations"))}
            className="flex items-center gap-2"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
          {topConversations.length === 0 ? (
            <Card className="col-span-full py-8 text-center bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardContent>
                <Sparkles className="h-12 w-12 text-amber-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No featured discussions yet</h3>
                <p className="text-gray-600 mb-6">Complete conversations to see them featured here</p>
                <Button
                  onClick={() => navigate(createPageUrl("FindPartners"))}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Find Discussion Partners
                </Button>
              </CardContent>
            </Card>
          ) : (
            topConversations.map(conv => (
              <Card 
                key={conv.id} 
                className="hover:shadow-md transition-all duration-300 cursor-pointer border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 overflow-hidden"
                onClick={() => navigate(`${createPageUrl("ChatView")}?id=${conv.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <Badge className="bg-gradient-to-r from-purple-100 to-indigo-100 text-indigo-700 border-0">
                      {conv.topic?.category}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 bg-white">
                      <Award className="h-3 w-3 text-amber-500" />
                      {conv.totalScore} pts
                    </Badge>
                  </div>
                  
                  <h3 className="font-medium text-lg mb-3 line-clamp-2">{conv.topic?.title}</h3>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex -space-x-2">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ring-2 ring-white"
                        style={{ backgroundColor: conv.participant1?.avatar_color }}
                      >
                        {conv.participant1?.display_name?.charAt(0)}
                      </div>
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ring-2 ring-white"
                        style={{ backgroundColor: conv.participant2?.avatar_color }}
                      >
                        {conv.participant2?.display_name?.charAt(0)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Insightful discussion on {conv.topic?.category}
                    </div>
                  </div>

                  {conv.ai_feedback && conv.ai_feedback[0] && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 text-indigo-900 text-sm font-medium mb-1">
                        <Lightbulb className="h-4 w-4 text-indigo-600" />
                        Key Insight
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {conv.ai_feedback[0].suggestion}
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-sm"
                    size="sm"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    View Discussion
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-0">
        {/* Community Leaders - simplified */}
        <section>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-r from-yellow-100 to-amber-100">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                Community Leaders
                <Badge className="bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-700 ml-2">
                  Top Contributors
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topUsers.length === 0 ? (
                <div className="text-center py-6">
                  <Trophy className="h-12 w-12 text-amber-200 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No leaders yet</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    Be the first to earn points by participating in meaningful discussions
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Topics"))}
                  >
                    Explore Topics
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {topUsers.map((user, index) => (
                    <div 
                      key={user.id} 
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/80 transition-colors cursor-pointer group"
                      onClick={() => navigate(`${createPageUrl("UserProfile")}?id=${user.id}`)}
                    >
                      <div className="relative">
                        {index === 0 && (
                          <div className="absolute -top-2 -left-2 md:-top-3 md:-left-3 w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-sm transform -rotate-6 shadow-lg ring-2 ring-yellow-200">
                            <Trophy className="w-3 h-3 md:w-4 md:h-4" />
                          </div>
                        )}
                        <Avatar 
                          user={user} 
                          size="lg"
                          className={`${index < 3 ? 'ring-[3px]' : ''}`}
                          style={{ 
                            boxShadow: index < 3 ? '0 0 20px rgba(99, 102, 241, 0.2)' : 'none',
                            ringColor: index === 0 ? 'rgb(252, 211, 77)' : 
                                      index === 1 ? 'rgb(226, 232, 240)' : 
                                      index === 2 ? 'rgb(180, 83, 9)' : 'transparent'
                          }}
                        />
                        {index === 1 && (
                          <div className="absolute -top-1 -left-1 md:-top-2 md:-left-2 w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-slate-300 to-slate-400 rounded-xl flex items-center justify-center text-white font-bold text-sm transform rotate-6 shadow-lg ring-2 ring-slate-200">
                            <Medal className="w-3 h-3 md:w-4 md:h-4" />
                          </div>
                        )}
                        {index === 2 && (
                          <div className="absolute -top-1 -left-1 md:-top-2 md:-left-2 w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-amber-700 to-amber-800 rounded-xl flex items-center justify-center text-white font-bold text-sm transform rotate-6 shadow-lg ring-2 ring-amber-200">
                            <Medal className="w-3 h-3 md:w-4 md:h-4" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                          {user.display_name}
                        </h3>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <span>{user.conversations_completed || 0} discussions</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            {user.total_points} pts
                          </span>
                        </div>
                      </div>

                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Quick Match - simplified */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Potential Discussion Partners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-600 mb-1">Find discussion partners</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Share your opinions on topics to get matched with others for meaningful discussions
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => navigate(createPageUrl("Topics"))}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Explore Topics
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(createPageUrl("FindPartners"))}
                  >
                    View Matching Options
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
