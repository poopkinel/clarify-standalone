
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { 
  MessageCircle, 
  ArrowRight, 
  ArrowLeft,
  Upload, 
  Clock,
  Loader2,
  Tag,
  Check,
  X,
  XCircle,
  Sparkles
} from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import { UploadFile, GenerateImage } from "@/api/integrations";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLanguage, AVAILABLE_LANGUAGES } from "@/components/utils/i18n";
import InterestsStep from '../components/onboarding/InterestsStep';

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

// Add AI avatar prompts
const AI_AVATAR_STYLES = [
  {
    name: "Anime",
    prompt: "single anime character portrait headshot, solo character, one person, centered, frontal view, clean background, professional profile picture style"
  },
  {
    name: "Artistic",
    prompt: "artistic digital portrait, minimalist style, natural features, friendly expression, soft colors, clean background"
  },
  {
    name: "3D",
    prompt: "3D rendered character portrait, natural features, modern style, professional headshot, clean background, photorealistic"
  },
  {
    name: "Pixel Art",
    prompt: "cute pixel art portrait, friendly character, vibrant colors, clean background, retro style"
  }
];

// Tag categories with icons and colors
const TAG_CATEGORIES = {
  'technology': { icon: '💻', color: 'bg-blue-100 text-blue-800' },
  'politics': { icon: '🏛️', color: 'bg-red-100 text-red-800' },
  'ethics': { icon: '⚖️', color: 'bg-purple-100 text-purple-800' },
  'environment': { icon: '🌱', color: 'bg-green-100 text-green-800' },
  'education': { icon: '📚', color: 'bg-amber-100 text-amber-800' },
  'health': { icon: '🩺', color: 'bg-emerald-100 text-emerald-800' },
  'economics': { icon: '📊', color: 'bg-indigo-100 text-indigo-800' },
  'culture': { icon: '🎭', color: 'bg-pink-100 text-pink-800' },
  'science': { icon: '🔬', color: 'bg-cyan-100 text-cyan-800' },
  'social': { icon: '👥', color: 'bg-violet-100 text-violet-800' },
  'lifestyle': { icon: '🏡', color: 'bg-yellow-100 text-yellow-800' },
  'food': { icon: '🍽️', color: 'bg-orange-100 text-orange-800' },
  'work': { icon: '💼', color: 'bg-slate-100 text-slate-800' },
  'space': { icon: '🚀', color: 'bg-gray-100 text-gray-800' },
  'future': { icon: '🔮', color: 'bg-indigo-100 text-indigo-800' }
};

export default function Onboarding() {
  // First, initialize all state variables
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [avatarImage, setAvatarImage] = useState(null);
  const [avatarType, setAvatarType] = useState("color");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [user, setUser] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);  // Initialize this first
  const [nameError, setNameError] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // Then other non-state variables
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showToast } = useAppToast();
  const fileInputRef = React.useRef(null);
  const { currentLanguage, changeLanguage, t, direction } = useLanguage();

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
    }, 10000); // 10 seconds timeout
    
    return () => clearTimeout(timer);
  }, []);

  // Load user data and check for existing profile
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Try to get user data
        const userData = await User.me();
        setUser(userData);
        
        // Pre-fill display name with user's name if available
        if (userData.full_name) {
          setDisplayName(userData.full_name);
        }
        
        // Try to find existing profile
        try {
          const profiles = await UserProfile.filter({ user_id: userData.id });
          
          if (profiles.length > 0) {
            // User has a profile, store it and redirect to Topics
            localStorage.setItem('userProfile', JSON.stringify(profiles[0]));
            navigate(createPageUrl("Topics"));
            return;
          }
        } catch (profileError) {
          console.error("Error loading profile:", profileError);
          // Continue with onboarding even if profile fetching fails
        }
        
        // No profile found, show onboarding
        setCheckingProfile(false);
      } catch (error) {
        console.error("Error loading user:", error);
        
        // Handle auth error
        if (error.message?.includes("unauthorized")) {
          navigate(createPageUrl("Landing"));
          return;
        }
        
        // For other errors, show onboarding anyway as fallback
        setCheckingProfile(false);
      }
    };

    loadUser();
  }, []);

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setAvatarType("color");
    setAvatarImage(null);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  // Update the nextStep function to handle the new step for tag selection
  const nextStep = async () => {
    if (step === 2) { // Update step number for name validation
      if (!displayName.trim()) {
        showToast(
          t("please_enter_display_name"),
          t("display_name_required"),
          "destructive"
        );
        return;
      }
      
      setIsCheckingName(true);
      
      try {
        const profiles = await UserProfile.list();
        
        const nameExists = profiles.some(profile => 
          profile.display_name && 
          profile.display_name.toLowerCase() === displayName.toLowerCase()
        );
        
        if (nameExists) {
          setNameError(t("display_name_taken"));
          showToast(
            t("display_name_taken"),
            t("choose_different_name"),
            "destructive"
          );
          setIsCheckingName(false);
          return;
        }
        
        setStep(step + 1);
      } catch (error) {
        console.error("Error checking display name:", error);
        showToast(
          t("error_checking_display_name"),
          t("please_try_again"),
          "destructive"
        );
      } finally {
        setIsCheckingName(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleDisplayNameChange = (e) => {
    const newName = e.target.value;
    setDisplayName(newName);
    
    // Clear any previous errors when typing
    if (nameError) {
      setNameError("");
    }
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // File validation
    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      showToast(
        "Invalid file type",
        "Please upload a JPG, PNG, or GIF image",
        "destructive"
      );
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      showToast(
        "File too large",
        "Please upload an image smaller than 5MB",
        "destructive"
      );
      return;
    }
    
    setSelectedFile(file);
    
    // Create a preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarImage(reader.result);
      setAvatarType("upload");
    };
    reader.readAsDataURL(file);
  };

  // Handle avatar upload
  const uploadAvatar = async () => {
    if (!selectedFile) {
      // If there's no file selected, open file dialog
      fileInputRef.current?.click();
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Upload the file
      const result = await UploadFile({
        file: selectedFile
      });
      
      if (result && result.file_url) {
        setAvatarImage(result.file_url);
        setAvatarType("upload");
        showToast("Avatar uploaded successfully");
      } else {
        showToast(
          "Avatar upload failed",
          "Please try again",
          "destructive"
        );
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      showToast(
        "Error uploading avatar",
        "Please try again later",
        "destructive"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async (tagsFromStep) => { // Receive tags from InterestsStep
    if (!displayName.trim()) {
      showToast(
        "Please enter a display name",
        "A display name is required to continue",
        "destructive"
      );
      return;
    }

    setIsLoading(true);
    try {
      // Check name uniqueness one more time before submission
      const profiles = await UserProfile.list();
      const nameExists = profiles.some(profile => 
        profile.display_name && 
        profile.display_name.toLowerCase() === displayName.toLowerCase() &&
        profile.user_id !== user?.id
      );
      
      if (nameExists) {
        showToast(
          "Display name already taken",
          "Please go back and choose a different name",
          "destructive"
        );
        setIsLoading(false);
        return;
      }

      // Get current user if not already loaded
      let userId = user?.id;
      if (!userId) {
        try {
          const userData = await User.me();
          userId = userData.id;
          setUser(userData);
        } catch (error) {
          console.error("Error getting user:", error);
          showToast(
            "Error creating profile",
            "Could not identify current user",
            "destructive"
          );
          setIsLoading(false);
          return;
        }
      }

      const finalSelectedTags = tagsFromStep || JSON.parse(localStorage.getItem('initial_tag_filters') || '[]');

      const profileData = {
        user_id: userId,
        display_name: displayName,
        avatar_color: selectedColor,
        level: 1,
        total_points: 0,
        conversations_completed: 0,
        badges: ["newcomer"],
        highest_scores: {
          empathy: 0,
          clarity: 0,
          open_mindedness: 0
        },
        preferred_tags: finalSelectedTags // Use tags from InterestsStep
      };

      // Process avatar image
      let avatarImageUrl = null;
      
      if (avatarType === "upload" && selectedFile) {
        try {
          console.log("Uploading file:", selectedFile.name);
          const result = await UploadFile({ file: selectedFile });
          console.log("Upload result:", result);
          
          if (result && result.file_url) {
            avatarImageUrl = result.file_url;
          }
        } catch (error) {
          console.error("Error uploading avatar:", error);
          showToast("Error uploading avatar", "Using default avatar instead", "destructive");
        }
      }
      
      // Set avatar image if we have a URL
      if (avatarImageUrl) {
        console.log("Setting avatar image URL:", avatarImageUrl);
        profileData.avatar_image = avatarImageUrl;
      }

      console.log("Creating profile with data:", profileData);
      const newProfile = await UserProfile.create(profileData);
      console.log("Created profile:", newProfile);

      // Store profile in localStorage
      localStorage.setItem('userProfile', JSON.stringify(newProfile));
      localStorage.removeItem('initial_tag_filters'); // Clean up
      
      // Navigate to Topics with selected tags and union filtering
      if (finalSelectedTags.length > 0) {
        const params = new URLSearchParams({
          tags: finalSelectedTags.join(','),
          filterMode: 'union'
        });
        navigate(`${createPageUrl("Topics")}?${params.toString()}`, { replace: true });
      } else {
        navigate(createPageUrl("Topics"), { replace: true });
      }
      
      showToast(
        "Welcome to MindfulChat!",
        "Your profile has been created successfully"
      );
    } catch (error) {
      showToast(
        "Error creating profile",
        "Please try again",
        "destructive"
      );
      console.error("Error creating profile:", error);
    }
    setIsLoading(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-lg font-medium text-gray-900">
                {t('choose_language')}
              </Label>
              <p className="text-gray-500 mb-6">
                {t('select_language_description')}
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(AVAILABLE_LANGUAGES).map(([code, lang]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      changeLanguage(code);
                      // Add small delay to ensure language change is processed
                      setTimeout(() => nextStep(), 100);
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                      currentLanguage === code 
                        ? 'bg-indigo-600 text-white border-indigo-700' 
                        : 'bg-white hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">
                        {code === 'he' ? 'עברית' : lang.nativeName}
                      </span>
                      <span className={`${currentLanguage === code ? 'text-indigo-100' : 'text-gray-500'} text-sm`}>
                        {lang.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={nextStep}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-lg py-6 flex items-center justify-center"
            >
              {direction === 'rtl' ? (
                <>
                  <ArrowLeft className="h-5 w-5 ml-2" />
                  {t('next_step')}
                </>
              ) : (
                <>
                  {t('next_step')}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="displayName" className="text-lg font-medium">
                {t('choose_display_name')}
              </Label>
              <p className="text-gray-500 mb-4">
                {t('display_name_description')}
              </p>
              <Input
                id="displayName"
                value={displayName}
                onChange={handleDisplayNameChange}
                placeholder={t('your_display_name')}
                className={`text-lg py-6 ${nameError ? 'border-red-500' : ''}`}
                maxLength={20}
              />
              {nameError && (
                <p className="text-red-500 text-sm mt-1">{t(nameError)}</p>
              )}
              {isCheckingName && (
                <p className="text-indigo-500 text-sm mt-1">{t('checking_name')}</p>
              )}
            </div>
            <Button
              onClick={nextStep}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-lg py-6 flex items-center justify-center"
              disabled={isCheckingName}
            >
              {isCheckingName ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : null}
              {direction === 'rtl' ? (
                <>
                  <ArrowLeft className="h-5 w-5 ml-2" />
                  {t('next_step')}
                </>
              ) : (
                <>
                  {t('next_step')}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-lg font-medium">
                {t('choose_avatar')}
              </Label>
              <p className="text-gray-500 mb-4">
                {t('avatar_description')}
              </p>
              
              <Tabs defaultValue="color" className="space-y-4">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="color">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                      <span>{t('color')}</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span>{t('upload')}</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="ai">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>{t('ai_generate')}</span>
                    </div>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="color">
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={`w-full aspect-square rounded-full transition-all transform ${
                          selectedColor === color && avatarType === "color" 
                            ? "ring-4 ring-indigo-300 scale-110" 
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select ${color} as avatar color`}
                      />
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="upload" className="space-y-4">
                  <div className="flex justify-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/png, image/jpeg, image/gif"
                      className="hidden"
                    />
                    <Button
                      onClick={uploadAvatar}
                      variant={avatarType === "upload" && avatarImage ? "outline" : "default"}
                      className="flex items-center gap-2 w-full justify-center"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>{avatarType === "upload" && avatarImage ? t('change_image') : t('upload_image')}</span>
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {AI_AVATAR_STYLES.map((style) => (
                      <Button
                        key={style.name}
                        onClick={async () => {
                          setIsLoading(true);
                          try {
                            const result = await GenerateImage({
                              prompt: style.prompt + `, ${displayName ? `, representing ${displayName}` : ''}`
                            });
                            if (result.url) {
                              setAvatarImage(result.url);
                              setAvatarType("ai");
                            }
                          } catch (error) {
                            console.error("Error generating AI avatar:", error);
                            showToast(
                              t("error_generating_avatar"),
                              t("please_try_again"),
                              "destructive"
                            );
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                        variant="outline"
                        className="p-4 h-auto flex flex-col items-center gap-2"
                      >
                        <Sparkles className="h-8 w-8 text-indigo-500" />
                        <span>{style.name}</span>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Preview */}
              <div className="flex justify-center mt-6">
                {avatarImage ? (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-100">
                    <img 
                      src={avatarImage} 
                      alt="Avatar preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div 
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-indigo-100"
                    style={{ backgroundColor: selectedColor }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-4">
              <Button
                onClick={prevStep}
                variant="outline"
                className="w-1/2 text-lg py-6 flex items-center justify-center"
              >
                {direction === 'rtl' ? (
                  <>
                    {t('back')}
                    <ArrowRight className="h-5 w-5 mr-2" />
                  </>
                ) : (
                  <>
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    {t('back')}
                  </>
                )}
              </Button>
              <Button
                onClick={nextStep}
                className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-lg py-6 flex items-center justify-center"
              >
                {direction === 'rtl' ? (
                  <>
                    <ArrowLeft className="h-5 w-5 ml-2" />
                    {t('next_step')}
                  </>
                ) : (
                  <>
                    {t('next_step')}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      case 4: // New step for Interests
        return (
          <InterestsStep
            onNext={(tags) => {
              setSelectedTags(tags); // Store selected tags from the component
              handleFinish(tags); // Pass tags to handleFinish
            }}
            onBack={prevStep}
          />
        );
      default:
        return null;
    }
  };

  // Show loading spinner while checking profile, but with a timeout fallback
  if (checkingProfile && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}...</p>
        </div>
      </div>
    );
  }

  // If we hit the timeout, just show the onboarding form
  if (loadingTimeout && checkingProfile) {
    setCheckingProfile(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col">
      <header className="py-6 px-4">
        <div dir={direction} className="max-w-md mx-auto">
          <Link to={createPageUrl("Landing")} className={`flex items-centerjustify-start`}>
            <img 
              src="https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png" 
              alt="Clarify Logo" 
              className="w-10 h-10"
            />
            <span className={`text-gray-800 ${direction === 'rtl' ? 'mr-2' : 'ml-2'} text-xl font-bold`}>{t('app_name')}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className={`mb-8 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
            <h1 className="text-2xl font-bold text-gray-900">{t('welcome_to_mindfulchat')}</h1>
            <p className="text-gray-600 mt-2">
              {t('setup_profile_description')}
            </p>
          </div>

          <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
}
