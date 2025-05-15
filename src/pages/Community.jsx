
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { UserProfile } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  Trophy,
  Users,
  MessageCircle,
  Sparkles,
  Award,
  Brain,
  Clock,
  Filter,
  UserIcon,
  Star,
  BookOpen,
  Medal,
  Zap,
  MessageSquare,
  X
} from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import { retryWithBackoff, delay } from "../components/utils/apiHelpers";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from '@/components/utils/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Community() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const { t, direction } = useLanguage();
  const [viewMode, setViewMode] = useState("all");
  const [sortMode, setSortMode] = useState("level");

  useEffect(() => {
    loadCommunityData();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      filterUsers();
    }
  }, [searchQuery, users]);

  const loadCommunityData = async () => {
    setIsLoading(true);
    try {
      // Check for cached data first
      const cachedData = localStorage.getItem('communityPageData');
      if (cachedData) {
        const { users: cachedUsers, leaderboard: cachedLeaderboard, timestamp } = JSON.parse(cachedData);
        
        // Use cache if it's less than 10 minutes old
        if (Date.now() - timestamp < 600000) {
          console.log("[Community] Using cached data");
          setUsers(cachedUsers);
          setLeaderboard(cachedLeaderboard);
          setFilteredUsers(cachedUsers);
          setIsLoading(false);
          
          // Load fresh data in background
          loadFreshData();
          return;
        }
      }
      
      await loadFreshData();
    } catch (error) {
      console.error("Error loading community data:", error);
      showToast(
        "Error loading community data",
        "Please try again later",
        "destructive"
      );
      setIsLoading(false);
    }
  };
  
  const loadFreshData = async () => {
    try {
      // Load all user profiles with retry and limit
      const allProfiles = await retryWithBackoff(() => UserProfile.list("-total_points", 50));
      
      console.log("[Community] Loaded profiles:", allProfiles.length);
      
      // Process profiles in batches
      const BATCH_SIZE = 5;
      const processedProfiles = [];
      
      for (let i = 0; i < allProfiles.length; i += BATCH_SIZE) {
        const batch = allProfiles.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (profile) => {
          try {
            // Update profiles with missing data
            if (!profile.badges || !profile.avatar_color || !profile.level) {
              await UserProfile.update(profile.id, {
                badges: profile.badges || ["newcomer"],
                avatar_color: profile.avatar_color || getRandomColor(),
                level: profile.level || Math.floor(Math.random() * 5) + 1,
                total_points: profile.total_points || Math.floor(Math.random() * 500),
                conversations_completed: profile.conversations_completed || Math.floor(Math.random() * 10),
                highest_scores: profile.highest_scores || {
                  empathy: Math.floor(Math.random() * 10),
                  clarity: Math.floor(Math.random() * 10),
                  open_mindedness: Math.floor(Math.random() * 10)
                }
              });
              await delay(300); // Add delay between updates
            }
            
            processedProfiles.push(profile);
          } catch (error) {
            console.error("Error processing profile:", error);
            processedProfiles.push(profile);
          }
        }));
        
        // Update state with partial data for progressive loading
        setUsers([...processedProfiles]);
        setFilteredUsers([...processedProfiles]);
        
        // Add delay between batches
        if (i + BATCH_SIZE < allProfiles.length) {
          await delay(300);
        }
      }
      
      // Get top users for leaderboard
      const topUsers = [...processedProfiles]
        .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
        .slice(0, 10);
      setLeaderboard(topUsers);
      
      // Cache the data
      localStorage.setItem('communityPageData', JSON.stringify({
        users: processedProfiles,
        leaderboard: topUsers,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error("Error loading fresh community data:", error);
      showToast("Error refreshing community data", "Using cached data instead", "destructive");
    }
    
    setIsLoading(false);
  };

  // Helper function to generate random colors
  const getRandomColor = () => {
    const colors = [
      "#6366F1", // Indigo
      "#8B5CF6", // Violet
      "#EC4899", // Pink
      "#F43F5E", // Rose
      "#10B981", // Emerald
      "#06B6D4", // Cyan
      "#F59E0B", // Amber
      "#EF4444", // Red
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => 
      user.display_name?.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  // Loading skeleton for user cards
  const UserCardSkeleton = () => (
    <div className="animate-pulse">
      <Card>
        <CardContent className="p-6">
          <div className={`flex items-center gap-4 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className={`h-5 bg-gray-200 rounded w-1/3 mb-2 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
              <div className={`h-4 bg-gray-200 rounded w-1/4 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div dir={direction} className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        <header>
          <h1 className={`text-3xl font-bold text-gray-900 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
            {t("community_title")}
          </h1>
          <p className={`text-gray-600 mt-1 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
            {t("community_description")}
          </p>
        </header>

        {/* Filter Bar */}
        <div className={`bg-white rounded-lg shadow-sm mt-6 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
          <div className="p-5 border-b">
            <h2 className={`font-semibold text-gray-900 mb-4 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
              {t("find_members")}
            </h2>
            
            <div className={`flex ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'} flex-wrap gap-3`}>
              <div className="flex-1 min-w-[200px]">
                <div className={`relative ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <Search className={`absolute top-2.5 ${direction === 'rtl' ? 'right-3' : 'left-3'} h-4 w-4 text-gray-400`} />
                  <Input
                    placeholder={t("search_members_placeholder")}
                    className={`pl-10 ${direction === 'rtl' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'}`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Select 
                  value={viewMode} 
                  onValueChange={setViewMode}
                >
                  <SelectTrigger className={`w-[140px] ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <SelectValue placeholder={t("filter_mode")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Users className="h-4 w-4" />
                        <span>{t("all_members")}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="leaders">
                      <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Award className="h-4 w-4" />
                        <span>{t("leaders")}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={sortMode} 
                  onValueChange={setSortMode}
                >
                  <SelectTrigger className={`w-[140px] ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <SelectValue placeholder={t("sort_by")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level">
                      <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Star className="h-4 w-4" />
                        <span>{t("level")}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="points">
                      <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Zap className="h-4 w-4" />
                        <span>{t("points")}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="discussions">
                      <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <MessageSquare className="h-4 w-4" />
                        <span>{t("discussions")}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {searchQuery && (
              <div className={`mt-3 flex ${direction === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className={`text-gray-500 flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}
                >
                  <X className="h-3 w-3 mr-1" />
                  {t("clear_search")}
                </Button>
              </div>
            )}
          </div>

          {/* Member List */}
          <div className="p-5">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <UserCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <Card className="bg-gradient-to-br from-gray-50 to-indigo-50 border-0 shadow-sm">
                <CardContent className="p-6 md:p-10 text-center">
                  <Search className="h-12 w-12 md:h-16 md:w-16 text-indigo-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-gray-800 mb-2">{t('no_members_found')}</h3>
                  <p className="text-gray-600 mb-4">
                    {t('no_members_found_description')}
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery("")}
                    className="px-4 md:px-6"
                  >
                    {t('clear_search')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {filteredUsers.map(user => (
                  <Card 
                    key={user.id}
                    className="hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm bg-white overflow-hidden"
                    onClick={() => navigate(`${createPageUrl("UserProfile")}?id=${user.id}`)}
                  >
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <CardContent className="p-4">
                      <div className={`flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Avatar 
                          user={user} 
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {user.display_name}
                          </h3>
                          <div className={`flex flex-wrap gap-2 mt-1 ${direction === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                            <Badge className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 border-0 flex items-center gap-1 text-xs">
                              <Award className="h-3 w-3" />
                              {t('level')} {user.level || 1}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1 bg-white text-xs">
                              <MessageCircle className="h-3 w-3" />
                              {user.conversations_completed || 0}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
