
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { delay, retryWithBackoff, entityCache } from "../components/utils/apiHelpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User as UserIcon, 
  Settings, 
  LineChart, 
  MessageSquare, 
  Award,
  Check,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Brain
} from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from '@/components/utils/i18n';
import LanguageSelector from '@/components/layout/LanguageSelector';

const AVATAR_COLORS = [
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#F59E0B", // Amber
  "#EF4444", // Red
];

export default function Profile() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    bio: "",
    avatar_color: "#6366f1"
  });
  const [opinions, setOpinions] = useState([]);
  const [topics, setTopics] = useState({});
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState({
    totalConversations: 0,
    avgScore: 0,
    bestCategory: "",
    level: 1
  });
  const [debugInfo, setDebugInfo] = useState(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { showToast } = useAppToast();

  // Add state to track if data was loaded recently
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Add a log to see profile data when it's loaded
  useEffect(() => {
    if (userProfile) {
      console.log("Loaded profile data:", {
        id: userProfile.id,
        display_name: userProfile.display_name,
        bio: userProfile.bio,
        bio_length: userProfile.bio ? userProfile.bio.length : 0
      });
    }
  }, [userProfile]);
  
  // Add rate limiting protection to loadData
  const loadData = async (forceReload = false) => {
    // Don't reload data if it was loaded in the last 30 seconds unless forced
    const now = Date.now();
    if (!forceReload && now - lastLoadTime < 30000) {
      console.log("Skipping reload - data was loaded recently");
      return;
    }
    
    setIsLoading(true);
    setIsRefreshing(forceReload);
    
    try {
      // Get current user - critical, so use retry logic
      const userData = await retryWithBackoff(() => User.me());
      setUser(userData);
      
      // Try to load profile from cache first
      let profileData = null;
      if (userData.id) {
        try {
          // Load profile with rate limit protection
          const profiles = await retryWithBackoff(() => 
            UserProfile.filter({ user_id: userData.id })
          );
          
          console.log("Loading profile data:", {
            profilesFound: profiles.length,
            firstProfile: profiles[0],
            timestamp: new Date().toISOString()
          });
          
          if (profiles.length > 0) {
            profileData = profiles[0];
            
            // Store in cache for future use
            entityCache.set('UserProfile', profileData.id, profileData);
            
            setUserProfile(profileData);
            
            console.log("Setting profile form with:", {
              display_name: profileData.display_name,
              bio: profileData.bio,
              avatar_color: profileData.avatar_color
            });
            
            // Init form
            setProfileForm({
              display_name: profileData.display_name || "",
              bio: profileData.bio || "",
              avatar_color: profileData.avatar_color || "#6366f1"
            });
            
            // Debug logging
            console.log("Profile loaded:", {
              id: profileData.id, 
              bio: profileData.bio,
              bioLength: profileData.bio ? profileData.bio.length : 0
            });
          } else {
            navigate(createPageUrl("Onboarding"));
            return;
          }
          
          if (profileData) {
            console.log("Loaded profile with avatar:", {
              id: profileData.id,
              avatar_image: profileData.avatar_image,
              avatar_image_type: typeof profileData.avatar_image,
              avatar_color: profileData.avatar_color
            });
          }
        } catch (error) {
          console.error("Error loading profile:", error);
          showToast(
            "Error loading profile",
            "Please try again later",
            "destructive"
          );
        }
      }
      
      // Load user opinions asynchronously with rate limit protection
      if (userData.id) {
        try {
          const opinions = await retryWithBackoff(() => 
            TopicOpinion.filter({ user_id: userData.id })
          );
          
          setOpinions(opinions);
          
          // Preload topics for these opinions (in batches)
          const topicIds = [...new Set(opinions.map(op => op.topic_id))];
          
          // Only load a few topics to avoid rate limits
          const topicBatch = topicIds.slice(0, 3);
          const topicsMap = {};
          
          if (topicBatch.length > 0) {
            for (const topicId of topicBatch) {
              try {
                // Check cache first
                let topic = entityCache.get('Topic', topicId);
                
                if (!topic) {
                  await delay(300); // Add small delay between requests
                  topic = await Topic.get(topicId);
                  entityCache.set('Topic', topicId, topic);
                }
                
                topicsMap[topicId] = topic;
              } catch (err) {
                console.warn(`Couldn't load topic ${topicId}:`, err);
              }
            }
          }
          
          setTopics(topicsMap);
        } catch (error) {
          console.error("Error loading opinions:", error);
        }
      }
      
      // Load conversations asynchronously with rate limit protection and filter client-side
      try {
        // Use cache or limited results
        let latestConversations = [];
        
        try {
          // Load just a few conversations to avoid rate limits
          latestConversations = await retryWithBackoff(() => 
            Conversation.list("-created_date", 5)
          );
        } catch (error) {
          console.warn("Error loading conversations:", error);
          latestConversations = [];
        }
        
        // Filter on client side
        const userConversations = latestConversations.filter(conv => 
          conv.participant1_id === userData.id || 
          conv.participant2_id === userData.id
        );
        
        setConversations(userConversations);
      } catch (error) {
        console.error("Error processing conversations:", error);
      }
      
      setLastLoadTime(now);
    } catch (error) {
      console.error("Error loading profile data:", error);
      showToast(
        "Error loading profile",
        "Please try again later",
        "destructive"
      );
    }
    
    setIsLoading(false);
    setIsRefreshing(false);
  };

  const getRandomColor = () => {
    const colors = [
      "#6366f1", // indigo
      "#8b5cf6", // violet
      "#ec4899", // pink
      "#f43f5e", // rose
      "#ef4444", // red
      "#f97316", // orange
      "#f59e0b", // amber
      "#84cc16", // lime
      "#10b981", // emerald
      "#06b6d4", // cyan
      "#3b82f6", // blue
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Optimized profile update function
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    try {
      console.log("Submitting profile update:", {
        formData: profileForm,
        profileId: userProfile?.id,
        timestamp: new Date().toISOString()
      });
      
      const updatedData = {
        display_name: profileForm.display_name,
        bio: profileForm.bio || "",
        avatar_color: profileForm.avatar_color
      };
      
      // Use retry pattern for this critical operation
      const updatedProfile = await retryWithBackoff(() => 
        UserProfile.update(userProfile.id, updatedData)
      );
      
      console.log("Profile update response:", {
        updatedProfile,
        timestamp: new Date().toISOString()
      });
      
      // Update state and cache
      setUserProfile(updatedProfile);
      entityCache.set('UserProfile', updatedProfile.id, updatedProfile);
      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      
      setIsEditing(false);
      
      showToast(
        "Profile updated",
        "Your profile has been updated successfully"
      );
      
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast(
        "Error updating profile",
        "Please try again later",
        "destructive"
      );
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatStance = (stance) => {
    switch (stance) {
      case "strongly_agree":
        return t("strongly_agree");
      case "agree":
        return t("agree");
      case "neutral":
        return t("neutral");
      case "disagree":
        return t("disagree");
      case "strongly_disagree":
        return t("strongly_disagree");
      default:
        return stance;
    }
  };

  const getStanceColor = (stance) => {
    switch (stance) {
      case "strongly_agree":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "agree":
        return "bg-green-100 text-green-800 border-green-200";
      case "neutral":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "disagree":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "strongly_disagree":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">{t('profile_title')}</h1>
        <p className="text-gray-600 mt-1">
          {t('profile_description')}
        </p>
      </header>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>{t('overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="my_opinions" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            <span>{t('my_opinions')} ({opinions?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>{t('settings')}</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Info */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile')}</CardTitle>
                  <CardDescription>{t('your_personal_information')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center text-center">
                    <Avatar 
                      user={userProfile} 
                      size="2xl"
                      className="mx-auto"
                    />

                    <h2 className="text-xl font-bold mt-4">{userProfile?.display_name}</h2>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Award className="h-4 w-4 text-indigo-500" />
                      <span>{t('level')} {userProfile?.level || 1}</span>
                    </div>

                    {/* Bio display */}
                    {userProfile?.bio && (
                      <div className="mt-4 w-full p-4 bg-gray-50 rounded-lg text-left">
                        <p className="text-gray-600">{userProfile.bio}</p>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={() => setIsEditing(true)}
                    >
                      {t('edit_profile')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats Card */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('stats')}</CardTitle>
                  <CardDescription>{t('your_activity_and_achievements')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">{t('conversations')}</div>
                    <div className="text-2xl font-bold">
                      {conversations.filter(c => c.status !== "rejected").length || 0}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">{t('completed')}</div>
                    <div className="text-2xl font-bold">
                      {conversations.filter(c => c.status === "completed").length || 0}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">{t('topics_engaged')}</div>
                    <div className="text-2xl font-bold">{Object.keys(topics).length}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">{t('average_score')}</div>
                    <div className="text-2xl font-bold">{stats.avgScore || 0}</div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <div className="text-sm font-medium">{t('level_progress')}</div>
                    <div className="text-sm text-gray-500">
                      {userProfile ? userProfile.total_points % 100 : 0}/100 {t('points')}
                    </div>
                  </div>
                  <Progress 
                    value={userProfile ? userProfile.total_points % 100 : 0} 
                    className="h-2" 
                  />
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">{t('communication_skills')}</h4>
                  <div className="space-y-3">
                    {['empathy', 'clarity', 'open_mindedness'].map(skill => {
                      const highestScores = userProfile?.highest_scores || {};
                      const value = highestScores[skill] || 0;
                      
                      return (
                        <div key={skill}>
                          <div className="flex justify-between mb-1">
                            <div className="text-sm capitalize">{skill.replace('_', ' ')}</div>
                            <div className="text-sm text-gray-500">
                              {t('best_score')}: {value}
                            </div>
                          </div>
                          <Progress value={value * 10} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => navigate(createPageUrl("Achievements"))}
                  >
                    <Award className="w-4 h-4 mr-2" />
                    {t('view_achievements')}
                  </Button>
                </div>
              </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="my_opinions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('my_opinions')}</CardTitle>
              <CardDescription>
                {t('topics_youve_expressed_opinions_on')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {opinions.length === 0 ? (
                <div className="text-center py-6">
                  <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-1">{t('no_opinions_yet')}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {t('express_your_opinions_on_topics_to_get_matched_with_others')}
                  </p>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => navigate(createPageUrl("Topics"))}
                  >
                    {t('explore_topics')}
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {opinions.map(opinion => {
                      const topic = topics[opinion.topic_id];
                      if (!topic) return null;
                      
                      return (
                        <Card key={opinion.id} className="shadow-none border">
                          <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-lg">{topic.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`border ${getStanceColor(opinion.stance)} flex items-center gap-1.5`}
                              >
                                {getStanceIcon(opinion.stance)}
                                {formatStance(opinion.stance)}
                              </Badge>
                              
                              <Badge 
                                variant="outline" 
                                className={opinion.willing_to_discuss ? "bg-blue-50 text-blue-800" : ""}
                              >
                                {opinion.willing_to_discuss ? t('open_to_discuss') : t('not_discussing')}
                              </Badge>
                            </div>
                            
                            {opinion.reason && (
                              <div className="mt-3">
                                <Label className="text-sm text-gray-500">{t('your_reason')}:</Label>
                                <p className="text-sm mt-1 p-2 bg-gray-50 rounded-md">
                                  {opinion.reason}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile_settings')}</CardTitle>
              <CardDescription>
                {t('update_your_personal_information')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit}>
                <div className="space-y-4">

                  {/* Add Language Settings section */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('settings_language')}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {t('language_description')}
                    </p>
                    <div className="max-w-xs">
                      <LanguageSelector variant="outline" />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="display_name">{t('display_name')}</Label>
                    <Input
                      id="display_name"
                      name="display_name"
                      value={profileForm.display_name}
                      onChange={handleChange}
                      placeholder={t('your_display_name')}
                      required
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="bio">{t('bio')}</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={profileForm.bio || ""}
                      onChange={handleChange}
                      placeholder={t('a_short_bio_about_yourself')}
                      rows={4}
                      className="resize-none"
                    />
                    {/* Add debugging info */}
                    <div className="text-xs text-gray-500">
                      {t('bio_length')}: {profileForm.bio ? profileForm.bio.length : 0} {t('characters')}
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="avatar_color">{t('avatar_color')}</Label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        id="avatar_color"
                        name="avatar_color"
                        value={profileForm.avatar_color}
                        onChange={handleChange}
                        className="w-10 h-10 border-none rounded-md cursor-pointer"
                      />
                      <div 
                        className="w-10 h-10 rounded-full"
                        style={{ backgroundColor: profileForm.avatar_color }}
                      ></div>
                      <span className="text-sm text-gray-500">
                        {profileForm.avatar_color.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={async () => {
                        try {
                          console.log("Testing direct bio update...");
                          // Try a direct update with just the bio
                          const result = await UserProfile.update(userProfile.id, {
                            bio: profileForm.bio
                          });
                          console.log("Direct bio update result:", result);
                          showToast("Bio updated directly", "Check console for details");
                          
                          // Force refresh profile
                          setUserProfile({...result});
                        } catch (error) {
                          console.error("Direct bio update failed:", error);
                          showToast("Direct update failed", "See console for details", "destructive");
                        }
                      }}
                    >
                      {t('debug_set_bio_directly')}
                    </Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                      {t('save_profile')}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>{t('account_information')}</CardTitle>
              <CardDescription>
                {t('your_account_details')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">{t('email')}</Label>
                  <div className="text-sm font-medium">{user?.email || t('not_available')}</div>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-500">{t('name')}</Label>
                  <div className="text-sm font-medium">{user?.full_name || t('not_available')}</div>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-500">{t('role')}</Label>
                  <Badge className="mt-1">{user?.role || "user"}</Badge>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-500">{t('joined_on')}</Label>
                  <div className="text-sm font-medium">
                    {user?.created_date ? new Date(user.created_date).toLocaleDateString() : t('unknown')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Modal for editing profile */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsEditing(false)}>
          <Card className="w-full max-w-md mx-4 bg-white" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>{t('edit_profile')}</CardTitle>
              <CardDescription>{t('update_your_personal_information')}</CardDescription>
            </CardHeader>
            <form onSubmit={handleProfileSubmit}>
              <CardContent>
                <div className="space-y-4">
                  <div className="mb-6 text-center">
                    <Avatar 
                      user={userProfile} 
                      size="2xl"
                      className="mx-auto"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="modal_display_name">{t('display_name')}</Label>
                    <Input
                      id="modal_display_name"
                      name="display_name"
                      value={profileForm.display_name}
                      onChange={handleChange}
                      placeholder={t('your_display_name')}
                      required
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="modal_bio">{t('bio')}</Label>
                    <Textarea
                      id="modal_bio"
                      name="bio"
                      value={profileForm.bio || ""}
                      onChange={handleChange}
                      placeholder={t('a_short_bio_about_yourself')}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="modal_avatar_color">{t('avatar_color')}</Label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        id="modal_avatar_color"
                        name="avatar_color"
                        value={profileForm.avatar_color}
                        onChange={handleChange}
                        className="w-10 h-10 border-none rounded-md cursor-pointer"
                      />
                      <span className="text-sm text-gray-500">
                        {profileForm.avatar_color.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="button" onClick={() => setIsEditing(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                  {t('save_changes')}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
