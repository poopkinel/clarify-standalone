
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Brain, Trophy, Star, Zap, MessageSquare, CheckCircle, Medal, Users, Lightbulb, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from '@/components/utils/i18n'; // Fixed import path

const BADGE_DEFINITIONS = {
  newcomer: {
    name: t => t("badge_newcomer"),
    description: t => t("badge_newcomer_desc"),
    icon: <Users className="h-6 w-6 text-blue-500" />,
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  first_conversation: {
    name: t => t("badge_first_chat"),
    description: t => t("badge_first_chat_desc"),
    icon: <MessageSquare className="h-6 w-6 text-green-500" />,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  five_conversations: {
    name: t => t("badge_conversation_starter"),
    description: t => t("badge_conversation_starter_desc"),
    icon: <MessageSquare className="h-6 w-6 text-indigo-500" />,
    color: "bg-indigo-100 text-indigo-800 border-indigo-200"
  },
  ten_conversations: {
    name: t => t("badge_social_butterfly"),
    description: t => t("badge_social_butterfly_desc"),
    icon: <Users className="h-6 w-6 text-purple-500" />,
    color: "bg-purple-100 text-purple-800 border-purple-200"
  },
  empathy_master: {
    name: t => t("badge_empathy_master"),
    description: t => t("badge_empathy_master_desc"),
    icon: <Brain className="h-6 w-6 text-pink-500" />,
    color: "bg-pink-100 text-pink-800 border-pink-200"
  },
  clarity_champion: {
    name: t => t("badge_clarity_champion"),
    description: t => t("badge_clarity_champion_desc"),
    icon: <Lightbulb className="h-6 w-6 text-amber-500" />,
    color: "bg-amber-100 text-amber-800 border-amber-200"
  },
  open_minded: {
    name: t => t("badge_open_minded"),
    description: t => t("badge_open_minded_desc"),
    icon: <Brain className="h-6 w-6 text-teal-500" />,
    color: "bg-teal-100 text-teal-800 border-teal-200"
  },
  perfectionist: {
    name: t => t("badge_perfectionist"),
    description: t => t("badge_perfectionist_desc"),
    icon: <Trophy className="h-6 w-6 text-yellow-500" />,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200"
  },
  level_5: {
    name: t => t("badge_rising_star"),
    description: t => t("badge_rising_star_desc"),
    icon: <Star className="h-6 w-6 text-orange-500" />,
    color: "bg-orange-100 text-orange-800 border-orange-200"
  },
  level_10: {
    name: t => t("badge_communication_expert"),
    description: t => t("badge_communication_expert_desc"),
    icon: <Medal className="h-6 w-6 text-red-500" />,
    color: "bg-red-100 text-red-800 border-red-200"
  }
};

export default function Achievements() {
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState({
    conversationsCompleted: 0,
    totalScore: 0,
    bestCategories: [],
    topicsDiversity: 0
  });

  const { t, direction } = useLanguage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      
      // Load user profile
      const profiles = await UserProfile.filter({ user_id: user.id });
      if (profiles.length > 0) {
        setUserProfile(profiles[0]);
        
        // Check for badges that might need to be awarded based on level
        await updateBadgesBasedOnLevel(profiles[0]);
      }
      
      // Load user's conversations
      const conversationsData = await Conversation.filter(
        { $or: [{ participant1_id: user.id }, { participant2_id: user.id }] }
      );
      
      setConversations(conversationsData);
      
      // Calculate stats
      calculateStats(conversationsData, user.id);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const updateBadgesBasedOnLevel = async (profile) => {
    const level = profile.level || 1;
    const badges = profile.badges || [];
    let newBadges = [...badges];
    let updated = false;
    
    // Check for level badges
    if (level >= 5 && !badges.includes("level_5")) {
      newBadges.push("level_5");
      updated = true;
    }
    
    if (level >= 10 && !badges.includes("level_10")) {
      newBadges.push("level_10");
      updated = true;
    }
    
    // Update profile if needed
    if (updated) {
      const updatedProfile = await UserProfile.update(profile.id, {
        badges: newBadges
      });
      setUserProfile(updatedProfile);
    }
  };

  const calculateStats = (conversationsData, userId) => {
    // Count completed conversations
    const completed = conversationsData.filter(
      conv => conv.status === "completed"
    ).length;
    
    // Calculate total score across all conversations
    let totalScore = 0;
    let categoryScores = {
      empathy: 0,
      clarity: 0,
      open_mindedness: 0
    };
    
    conversationsData.forEach(conv => {
      const score = conv.participant1_id === userId
        ? conv.participant1_score
        : conv.participant2_score;
      
      if (score) {
        totalScore += (score.total || 0);
        categoryScores.empathy += (score.empathy || 0);
        categoryScores.clarity += (score.clarity || 0);
        categoryScores.open_mindedness += (score.open_mindedness || 0);
      }
    });
    
    // Determine best categories
    const sortedCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
    
    // Count unique topics
    const uniqueTopics = new Set();
    conversationsData.forEach(conv => {
      uniqueTopics.add(conv.topic_id);
    });
    
    setStats({
      conversationsCompleted: completed,
      totalScore,
      bestCategories: sortedCategories.slice(0, 2), // Top 2 categories
      topicsDiversity: uniqueTopics.size
    });
  };

  // Render the badges the user has earned
  const renderBadges = () => {
    if (!userProfile || !userProfile.badges) return null;
    
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
        {userProfile.badges.map(badgeId => {
          const badge = BADGE_DEFINITIONS[badgeId];
          if (!badge) return null;
          
          return (
            <Card key={badgeId} className={`border ${badge.color} overflow-hidden`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${badge.color}`}>
                  {badge.icon}
                </div>
                <div>
                  <h3 className="font-bold">{badge.name(t)}</h3>
                  <p className="text-xs text-gray-600">{badge.description(t)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };
  
  // Render progress toward unearned badges
  const renderBadgeProgress = () => {
    if (!userProfile) return null;
    
    const earnedBadges = new Set(userProfile.badges || []);
    const unearned = Object.keys(BADGE_DEFINITIONS).filter(id => !earnedBadges.has(id));
    
    if (unearned.length === 0) return null;
    
    return (
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t("next_achievements")}</h2>
        <div className="space-y-4">
          {unearned.slice(0, 3).map(badgeId => {
            const badge = BADGE_DEFINITIONS[badgeId];
            let progress = 0;
            let progressText = "";
            
            // Calculate progress based on badge type
            if (badgeId === "first_conversation") {
              progress = stats.conversationsCompleted > 0 ? 100 : 0;
              progressText = `${stats.conversationsCompleted}/1 ${t("conversations_completed", {count: 1})}`;
            } else if (badgeId === "five_conversations") {
              progress = Math.min(100, (stats.conversationsCompleted / 5) * 100);
              progressText = `${stats.conversationsCompleted}/5 ${t("conversations_completed", {count: 5})}`;
            } else if (badgeId === "ten_conversations") {
              progress = Math.min(100, (stats.conversationsCompleted / 10) * 100);
              progressText = `${stats.conversationsCompleted}/10 ${t("conversations_completed", {count: 10})}`;
            } else if (badgeId === "level_5") {
              const level = userProfile.level || 1;
              progress = Math.min(100, (level / 5) * 100);
              progressText = `${t("level")} ${level}/5`;
            } else if (badgeId === "level_10") {
              const level = userProfile.level || 1;
              progress = Math.min(100, (level / 10) * 100);
              progressText = `${t("level")} ${level}/10`;
            }
            
            return (
              <div key={badgeId} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${badge.color}`}>
                      {badge.icon}
                    </div>
                    <h3 className="font-medium">{badge.name(t)}</h3>
                  </div>
                  <span className="text-sm text-gray-500">{progressText}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-gray-600 mt-2">{badge.description(t)}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div dir={direction} className="space-y-6 px-4 py-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">{t("achievements")}</h1>
        <p className="text-gray-600 mt-1">
          {t("achievements_description")}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-6"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Current level */}
          <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-indigo-100">{t("current_level")}</div>
                  <div className="text-4xl font-bold flex items-end gap-2">
                    {userProfile?.level || 1}
                    <span className="text-base text-indigo-100 mb-1">
                      {userProfile?.total_points || 0} {t("points")}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 md:mt-0">
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm">
                    <Trophy className="h-4 w-4 text-yellow-300" />
                    <span className="font-medium">
                      {t("badges_earned", { count: userProfile?.badges?.length || 0 })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Progress to next level */}
              <div className="mt-6">
                <div className="flex justify-between text-xs mb-1">
                  <span>{t("progress_to_level", { level: (userProfile?.level || 1) + 1 })}</span>
                  <span>
                    {userProfile ? userProfile.total_points % 100 : 0}/100 {t("points")}
                  </span>
                </div>
                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full"
                    style={{ width: `${userProfile ? userProfile.total_points % 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("conversations")}</div>
                  <div className="text-2xl font-bold">{conversations.length}</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-green-100 text-green-600 p-3 rounded-full">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("completed")}</div>
                  <div className="text-2xl font-bold">{stats.conversationsCompleted}</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-amber-100 text-amber-600 p-3 rounded-full">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("total_score")}</div>
                  <div className="text-2xl font-bold">{stats.totalScore}</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-purple-100 text-purple-600 p-3 rounded-full">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("best_skill")}</div>
                  <div className="text-2xl font-bold capitalize">
                    {stats.bestCategories[0] ? t(stats.bestCategories[0]) : t("none")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Badges */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{t("earned_badges")}</h2>
            {userProfile?.badges?.length ? (
              renderBadges()
            ) : (
              <Card className="bg-gray-50">
                <CardContent className="p-8 text-center">
                  <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-1">{t("no_badges_yet")}</h3>
                  <p className="text-gray-500 text-sm">
                    {t("no_badges_description")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Badge Progress */}
          {renderBadgeProgress()}
        </>
      )}
    </div>
  );
}
