
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Conversation } from "@/api/entities";
import { Topic } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Award, 
  MessageCircle,
  ArrowRight,
  Trophy,
  Sparkles,
  Lightbulb,
  Search,
  Filter,
  Users,
  ChevronRight,
  X
} from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import { delay } from "../utils/apiHelpers";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from '@/components/utils/i18n';
import { ParticipantDisplay } from './ParticipantDisplay';

const ParticipantAvatar = ({ participant }) => {
  if (!participant) return null;

  return (
    <Avatar 
      user={participant} 
      size="md" 
      className="ring-2 ring-white" 
    />
  );
};

// Update the tag color function to match the one from TopicCard
const getTagColor = (tag) => {
  const colors = {
    politics: "bg-blue-100 text-blue-800",
    ethics: "bg-purple-100 text-purple-800",
    technology: "bg-emerald-100 text-emerald-800",
    environment: "bg-green-100 text-green-800",
    education: "bg-amber-100 text-amber-800",
    healthcare: "bg-red-100 text-red-800",
    economics: "bg-indigo-100 text-indigo-800"
  };
  return colors[tag] || "bg-gray-100 text-gray-800";
};

export default function TopConversationsList() {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [topics, setTopics] = useState({});
  const [profiles, setProfiles] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMinScore, setFilterMinScore] = useState(0);
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const { t, direction } = useLanguage();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      // Load completed conversations with high scores
      const allConversations = await Conversation.list();
      
      // Filter for completed conversations with scores
      const completedConversations = allConversations.filter(conv => 
        conv.status === "completed" && 
        (conv.participant1_score?.total > 0 || conv.participant2_score?.total > 0)
      );
      
      // Sort by total score (sum of both participants)
      const sortedConversations = completedConversations.sort((a, b) => {
        const totalA = (a.participant1_score?.total || 0) + (a.participant2_score?.total || 0);
        const totalB = (b.participant1_score?.total || 0) + (b.participant2_score?.total || 0);
        return totalB - totalA;
      });
      
      // Take top N conversations
      const topConversations = sortedConversations.slice(0, 6);
      setConversations(topConversations);
      
      // Load topics data
      const topicIds = [...new Set(topConversations.map(conv => conv.topic_id))];
      const topicsMap = {};
      
      for (const topicId of topicIds) {
        try {
          const topic = await Topic.get(topicId);
          topicsMap[topicId] = topic;
        } catch (error) {
          console.error(`Error loading topic ${topicId}:`, error);
          // Add fallback when topic is not found
          topicsMap[topicId] = {
            id: topicId,
            title: t("Topic Unavailable"),
            description: t("This topic is no longer available"),
            category: t("Unknown")
          };
        }
        await delay(300); // Add delay to prevent rate limiting
      }
      
      setTopics(topicsMap);
      
      // Load user profiles
      const userIds = new Set();
      topConversations.forEach(conv => {
        userIds.add(conv.participant1_id);
        userIds.add(conv.participant2_id);
      });
      
      const profilesMap = {};
      for (const userId of userIds) {
        try {
          const userProfiles = await UserProfile.filter({ user_id: userId });
          if (userProfiles.length > 0) {
            profilesMap[userId] = userProfiles[0];
          }
        } catch (error) {
          console.error(`Error loading profile for user ${userId}:`, error);
        }
        await delay(300); // Add delay to prevent rate limiting
      }
      
      setProfiles(profilesMap);
    } catch (error) {
      console.error("Error loading top conversations:", error);
      showToast(
        t("Error loading conversations"),
        t("Please try again later"),
        "destructive"
      );
    }
    setIsLoading(false);
  };

  const getFilteredTopConversations = () => {
    return conversations.filter(conv => {
      // Filter by search query (check participants and topic)
      const searchLower = searchQuery.toLowerCase();
      const topic = topics[conv.topic_id];
      const matchesSearch = searchQuery === "" || 
        profiles[conv.participant1_id]?.display_name?.toLowerCase().includes(searchLower) ||
        profiles[conv.participant2_id]?.display_name?.toLowerCase().includes(searchLower) ||
        topic?.title.toLowerCase().includes(searchLower);
      
      // Filter by category
      const matchesCategory = filterCategory === "all" || 
        topic?.category === filterCategory;
      
      // Filter by minimum score
      const totalScore = (conv.participant1_score?.total || 0) + (conv.participant2_score?.total || 0);
      const matchesScore = totalScore >= filterMinScore;
      
      return matchesSearch && matchesCategory && matchesScore;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white rounded-xl shadow-sm p-6">
            <div className="h-7 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="flex gap-3 mb-4">
              <div className="h-8 bg-gray-200 rounded-full w-8"></div>
              <div className="h-8 bg-gray-200 rounded w-24"></div>
              <div className="h-8 bg-gray-200 rounded w-8"></div>
              <div className="h-8 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="h-5 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-2 gap-6 mt-6">
              <div>
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
              <div>
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <div className="h-9 bg-gray-200 rounded w-40"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filteredConversations = getFilteredTopConversations();
  
  if (conversations.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-indigo-50 border-0 shadow-md">
        <CardContent className="p-10 text-center">
          <Award className="h-16 w-16 text-indigo-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-800 mb-2">
            {t("No top conversations found")}
          </h3>
          <p className="text-gray-600 max-w-md mx-auto mb-6">
            {t("Complete more conversations with other users to see them featured here.")}
            {t("Top conversations showcase the best discussions on the platform.")}
          </p>
          <Button
            onClick={() => navigate(createPageUrl("FindPartners"))}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Users className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t("Find Discussion Partners")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-indigo-50 border-0 shadow-md">
        <CardContent className="p-10 text-center">
          <Search className="h-16 w-16 text-indigo-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-800 mb-2">
            {t("No matching conversations")}
          </h3>
          <p className="text-gray-600 max-w-md mx-auto mb-6">
            {t("We couldn't find any conversations matching your current filters.")}
            {t("Try adjusting your search criteria to see more results.")}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setFilterCategory("all");
              setFilterMinScore(0);
            }}
            className="px-6"
          >
            <Filter className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t("Clear filters")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
      {/* Search and filters */}
      <div className="mb-8 space-y-4 bg-white rounded-xl p-5 shadow-sm">
        <div className={`flex items-center gap-2 mb-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Filter className="h-5 w-5 text-indigo-500" />
          <h3 className="font-medium text-gray-800">{t("Filter Conversations")}</h3>
        </div>
        <div className={`flex flex-col sm:flex-row gap-3 ${direction === 'rtl' ? 'sm:flex-row-reverse' : ''}`}>
          <div className="flex-1">
            <Input
              placeholder={t("Search by participant name or topic...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
              prefix={<Search className="h-4 w-4 text-gray-400 mr-2" />}
            />
          </div>
          <Select
            value={filterCategory}
            onValueChange={setFilterCategory}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("Category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Categories")}</SelectItem>
              <SelectItem value="politics">{t("Politics")}</SelectItem>
              <SelectItem value="ethics">{t("Ethics")}</SelectItem>
              <SelectItem value="technology">{t("Technology")}</SelectItem>
              <SelectItem value="environment">{t("Environment")}</SelectItem>
              <SelectItem value="education">{t("Education")}</SelectItem>
              <SelectItem value="healthcare">{t("Healthcare")}</SelectItem>
              <SelectItem value="economics">{t("Economics")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterMinScore.toString()}
            onValueChange={(val) => setFilterMinScore(Number(val))}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("Min Score")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t("Any Score")}</SelectItem>
              <SelectItem value="10">{t("Min 10 pts")}</SelectItem>
              <SelectItem value="20">{t("Min 20 pts")}</SelectItem>
              <SelectItem value="30">{t("Min 30 pts")}</SelectItem>
              <SelectItem value="40">{t("Min 40 pts")}</SelectItem>
              <SelectItem value="50">{t("Min 50 pts")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversations list */}
      <div className="space-y-6">
        {filteredConversations.map((conv, idx) => {
          const topic = topics[conv.topic_id];
          const participant1 = profiles[conv.participant1_id];
          const participant2 = profiles[conv.participant2_id];
          const totalScore = (conv.participant1_score?.total || 0) + (conv.participant2_score?.total || 0);

          return (
            <Card 
              key={conv.id} 
              className={`overflow-hidden bg-white hover:shadow-md transition-all border-0 shadow-sm rounded-xl ${direction === 'rtl' ? 'text-right' : 'text-left'}`}
              onClick={() => navigate(`${createPageUrl("ChatView")}?id=${conv.id}`)}
            >
              <CardContent className="p-0">
                {/* Header with points badge */}
                <div className="relative">
                  {/* Background color based on first tag */}
                  <div className={`absolute top-0 ${direction === 'rtl' ? 'left-0 rounded-br-full' : 'right-0 rounded-bl-full'} w-28 h-28 bg-gradient-to-br from-yellow-100/50 to-yellow-200/80 z-0`}></div>
                  
                  {/* Points badge */}
                  <div className={`absolute top-4 ${direction === 'rtl' ? 'left-4' : 'right-4'} flex items-center z-10`}>
                    <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 shadow-sm">
                      <div className={`flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Sparkles className="h-4 w-4" />
                        <span dir="ltr" className="font-bold mx-1">{totalScore}</span>
                        <span>{t("pts")}</span>
                      </div>
                    </Badge>
                  </div>
                  
                  {/* Topic title and rank */}
                  <div className="p-5">
                    {idx < 3 && (
                      <Badge variant="outline" className={`mb-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-indigo-200 ${direction === 'rtl' ? 'mr-0' : 'ml-0'}`}>
                        {idx === 0 ? `🏆 ${t("Top Conversation")}` : idx === 1 ? `🥈 ${t("Runner Up")}` : `🥉 ${t("Notable Mention")}`}
                      </Badge>
                    )}
                    <h3 className={`text-xl font-semibold text-gray-900 ${direction === 'rtl' ? 'pl-16' : 'pr-16'}`}>
                      {topic?.title}
                    </h3>
                  </div>
                </div>
                
        {/* For RTL/LTR languages, we use the same component */}
        <ParticipantDisplay 
          participant1={participant1} 
          participant2={participant2} 
          topic={topic} 
        />

          {/* Insights */}
          <div dir={direction} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 mt-2 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-700 font-medium">
                <Lightbulb className="h-4 w-4" />
                <h4>{t("Key Insights")}</h4>
              </div>
              <div className="text-gray-600 text-sm">
                {conv.completion_feedback?.slice(0, 1).map((feedback, i) => (
                  <p key={i} className="italic line-clamp-3">
                    "{feedback.feedback}"
                  </p>
                ))}
                {!conv.completion_feedback?.length && (
                  <p className="text-gray-500 italic">{t("No insights shared")}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-700 font-medium">
                <Lightbulb className="h-4 w-4" />
                <h4>{t("Learning Highlights")}</h4>
              </div>
              <ul className="text-gray-600 text-sm space-y-1">
                {conv.ai_feedback?.slice(0, 1).map((feedback, i) => (
                  <li key={i} className="line-clamp-3">
                    {feedback.suggestion}
                  </li>
                ))}
                {!conv.ai_feedback?.length && (
                  <p className="text-gray-500 italic">{t("No highlights available")}</p>
                )}
              </ul>
            </div>
          </div>
          
          {/* View button */}
          <div dir={direction} className="p-5 pt-2 flex justify-end">
            <Button
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-sm flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`${createPageUrl("ChatView")}?id=${conv.id}`);
              }}
            >
              <MessageCircle className="h-4 w-4" />
              {t("View Full Conversation")}
              <ChevronRight className={`h-4 w-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            </Button>
          </div>
    </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
