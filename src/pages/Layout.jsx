

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { 
  MessageCircle, 
  Award, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  Bookmark,
  Settings,
  Sparkles,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { Conversation } from "@/api/entities";
import { Bell } from "lucide-react";
import { useAppToast } from "@/components/utils/toast";
import { Home as HomeIcon } from "lucide-react";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from '@/components/utils/i18n';
import LanguageSelector from '@/components/layout/LanguageSelector';
import NotificationPermission from "@/components/notifications/NotificationPermission";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";

export default function Layout({ children, currentPageName }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const { showToast } = useAppToast();
  const { t, direction } = useLanguage();

  const tokenCheckTimer = React.useRef(null);
  const lastAuthCheck = React.useRef(0);

  const loadData = async () => {
    try {
      const user = await User.me();
      if (user) {
        const profiles = await UserProfile.filter({ user_id: user.id });
        if (profiles.length > 0) {
          const profile = profiles[0];
          setUserProfile(profile);
          localStorage.setItem('userProfile', JSON.stringify(profile));
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  useEffect(() => {
    const checkForUpdates = async () => {
      if (userProfile) {
        try {
          const now = Date.now();
          const lastProfileCheckTime = parseInt(localStorage.getItem('lastProfileCheckTime') || '0');
          
          if (now - lastProfileCheckTime < 60000) {
            console.log("Skipping profile update check - checked recently");
            return;
          }
          
          const lastPointsChangeTime = parseInt(localStorage.getItem('pointsUpdated') || '0');
          const lastCheckTime = parseInt(localStorage.getItem('lastFullProfileCheck') || '0');
          
          if (lastPointsChangeTime > lastCheckTime || now - lastCheckTime > 300000) {
            const cachedProfiles = localStorage.getItem('cachedUserProfiles');
            if (cachedProfiles) {
              try {
                const profiles = JSON.parse(cachedProfiles);
                const profile = profiles.find(p => p.user_id === userProfile.user_id);
                if (profile && profile.total_points !== userProfile.total_points) {
                  setUserProfile(profile);
                  return;
                }
              } catch (e) {
                console.error("Error parsing cached profiles:", e);
              }
            }
            
            const profiles = await UserProfile.filter({ user_id: userProfile.user_id });
            if (profiles.length > 0) {
              const newProfile = profiles[0];
              if (newProfile.total_points !== userProfile.total_points) {
                setUserProfile(newProfile);
                
                try {
                  const cachedProfiles = JSON.parse(localStorage.getItem('cachedUserProfiles') || '[]');
                  const updatedProfiles = cachedProfiles
                    .filter(p => p.user_id !== newProfile.user_id)
                    .concat([newProfile]);
                  localStorage.setItem('cachedUserProfiles', JSON.stringify(updatedProfiles));
                } catch (e) {
                  console.error("Error updating profile cache:", e);
                }
              }
            }
            
            localStorage.setItem('lastFullProfileCheck', now.toString());
          }
          
          localStorage.setItem('lastProfileCheckTime', now.toString());
        } catch (error) {
          console.error("Error checking for profile updates:", error);
        }
      }
    };

    checkForUpdates();
    
    const interval = setInterval(checkForUpdates, 60000);
    return () => clearInterval(interval);
  }, [userProfile]);

  useEffect(() => {
    console.log("[layout.js] Checking redirect logic:", {
      isLoading,
      isLoggedIn,
      currentPageName,
      path: window.location.pathname,
      hasProfile: !!localStorage.getItem('userProfile'),
      timestamp: new Date().toISOString()
    });
    
    if (!isLoading && isLoggedIn) {
      const allowedPages = [
        "Dashboard", 
        "UserProfile",
        "Topics", 
        "Community", 
        "Conversations", 
        "TopConversations", 
        "Achievements", 
        "Profile", 
        "ChatView", 
        "FindPartners", 
        "AdminTopics"
      ];
      
      console.log("Current page check:", {
        currentPageName,
        isAllowed: allowedPages.includes(currentPageName),
        allowedPages
      });
      
      if (allowedPages.includes(currentPageName)) {
        console.log("[layout.js] On allowed page, preventing redirects");
        return;
      }

      if (window.location.pathname === "/" || currentPageName === "") {
        console.log("[layout.js] Root path detected, redirecting to Dashboard");
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }
      
      if (currentPageName === "Landing") {
        console.log("[layout.js] Landing page detected, redirecting to Dashboard");
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }
      
      const hasProfile = localStorage.getItem('userProfile');
      if (!hasProfile && currentPageName !== "Onboarding") {
        console.log("[layout.js] No profile found, redirecting to Onboarding");
        navigate(createPageUrl("Onboarding"), { replace: true });
        return;
      }
    }
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    const performAuthCheck = async () => {
      try {
        const now = Date.now();
        if (now - lastAuthCheck.current < 120000 && isLoggedIn) {
          return;
        }
        lastAuthCheck.current = now;

        const cachedProfile = localStorage.getItem('userProfile');
        const cachedUser = localStorage.getItem('userData');
        
        if (cachedProfile && cachedUser) {
          setUserProfile(JSON.parse(cachedProfile));
          setUser(JSON.parse(cachedUser));
          setIsLoggedIn(true);
          setIsLoading(false);
          return;
        }

        const userData = await User.me();
        setUser(userData);
        setIsLoggedIn(true);
        localStorage.setItem('userData', JSON.stringify(userData));
        
        try {
          const cachedProfiles = localStorage.getItem('cachedUserProfiles');
          let foundProfile = false;
          
          if (cachedProfiles) {
            try {
              const profiles = JSON.parse(cachedProfiles);
              const profile = profiles.find(p => p.user_id === userData.id);
              if (profile) {
                setUserProfile(profile);
                localStorage.setItem('userProfile', JSON.stringify(profile));
                foundProfile = true;
              }
            } catch (e) {
              console.error("Error parsing cached profiles:", e);
            }
          }
          
          if (!foundProfile) {
            const profiles = await UserProfile.filter({ user_id: userData.id });
            
            if (profiles.length > 0) {
              setUserProfile(profiles[0]);
              localStorage.setItem('userProfile', JSON.stringify(profiles[0]));
              
              try {
                const cachedProfiles = JSON.parse(localStorage.getItem('cachedUserProfiles') || '[]');
                const updatedProfiles = cachedProfiles
                  .filter(p => p.user_id !== profiles[0].user_id)
                  .concat([profiles[0]]);
                localStorage.setItem('cachedUserProfiles', JSON.stringify(updatedProfiles));
              } catch (e) {
                console.error("Error updating profiles cache:", e);
              }
            }
          }
        } catch (profileError) {
          console.error("Error loading profile:", profileError);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setIsLoggedIn(false);
        localStorage.removeItem('userProfile');
        localStorage.removeItem('userData');
      }
      setIsLoading(false);
    };

    performAuthCheck();
    
    const interval = setInterval(performAuthCheck, 600000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkInvitations = async () => {
      if (!isLoggedIn || !user?.id) return;
      
      const lastCheckTime = parseInt(localStorage.getItem('lastInvitationCheck') || '0');
      const now = Date.now();
      
      if (now - lastCheckTime < 300000) {
        console.log("Skipping invitation check - checked recently");
        return;
      }
      
      try {
        console.log("Checking for invitations for user:", user.id);
        await loadInvitations(user.id);
        localStorage.setItem('lastInvitationCheck', now.toString());
      } catch (error) {
        console.error("Error checking invitations:", error);
      }
    };
    
    if (isLoggedIn && user?.id) {
      checkInvitations();
    }
    
    const interval = setInterval(checkInvitations, 300000);  // Check every 5 minutes
    
    return () => clearInterval(interval);
  }, [isLoggedIn, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
      setIsLoading(false);
    }, 8000);
    
    return () => clearTimeout(timer);
  }, []);

  const loadInvitations = async (uid) => {
    if (!uid) return;
    try {
      const cachedInvitations = localStorage.getItem('cachedInvitations');
      const lastCacheTime = parseInt(localStorage.getItem('invitationsCacheTime') || '0');
      const now = Date.now();
      
      if (cachedInvitations && now - lastCacheTime < 300000) {
        setPendingInvitations(JSON.parse(cachedInvitations));
        return;
      }
      
      const invitedConversations = await Conversation.filter({ 
        participant2_id: uid,
        status: "invited"
      }, "-created_date", 3);
      
      setPendingInvitations(invitedConversations);
      
      localStorage.setItem('cachedInvitations', JSON.stringify(invitedConversations));
      localStorage.setItem('invitationsCacheTime', now.toString());
      
      const prevCount = pendingInvitations.length;
      if (invitedConversations.length > prevCount && prevCount !== 0) {
        toast({
          title: "New invitation received",
          description: "You have a new discussion invitation",
          action: (
            <Button onClick={() => navigate(createPageUrl("FindPartners"))}>
              View
            </Button>
          )
        });
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const now = Date.now();
        if (now - lastAuthCheck.current < 60000 && isLoggedIn) {
          return;
        }
        lastAuthCheck.current = now;

        const cachedProfile = localStorage.getItem('userProfile');
        const cachedUser = localStorage.getItem('userData');
        
        if (cachedProfile && cachedUser) {
          try {
            setUserProfile(JSON.parse(cachedProfile));
            setUser(JSON.parse(cachedUser));
            setIsLoggedIn(true);
            setIsLoading(false);
            
            if (Math.random() < 0.3) {
              try {
                const userData = JSON.parse(cachedUser);
                if (userData?.id) {
                  await loadInvitations(userData.id);
                }
              } catch (e) {
                console.warn('Error loading invitations:', e);
              }
            }
            
            return;
          } catch (e) {
            console.warn('Error parsing cached profile/user data');
          }
        }

        const userData = await User.me();
        setUser(userData);
        setIsLoggedIn(true);
        localStorage.setItem('userData', JSON.stringify(userData));
        
        const shouldCheckInvitations = !cachedUser;
        if (shouldCheckInvitations) {
          await loadInvitations(userData.id);
        }

        try {
          const profiles = await UserProfile.filter({ user_id: userData.id });
          
          if (profiles.length > 0) {
            setUserProfile(profiles[0]);
            localStorage.setItem('userProfile', JSON.stringify(profiles[0]));
          } else if (currentPageName !== "Onboarding") {
            navigate(createPageUrl("Onboarding"));
          }
        } catch (profileError) {
          console.error("Error loading profile:", profileError);
        }
      } catch (error) {
        console.error("Auth error:", error);
        
        if (error?.message?.includes('unauthorized') || error?.message?.includes('401')) {
          setIsLoggedIn(false);
          localStorage.removeItem('userProfile');
          localStorage.removeItem('userData');
          
          if (currentPageName !== "Landing" && currentPageName !== "Onboarding") {
            navigate(createPageUrl("Landing"));
          }
        } else {
          const cachedUser = localStorage.getItem('userData');
          if (cachedUser && !isLoggedIn) {
            try {
              setUser(JSON.parse(cachedUser));
              setIsLoggedIn(true);
            } catch (e) {
              console.error("Error parsing cached user data");
            }
          }
        }
      }
      setIsLoading(false);
    };

    checkAuth();
    
    tokenCheckTimer.current = setInterval(() => {
      if (isLoggedIn) {
        const shouldCheck = Math.random() < 0.2;
        if (shouldCheck) {
          const checkInvites = async () => {
            try {
              const cachedUser = localStorage.getItem('userData');
              if (cachedUser) {
                const userData = JSON.parse(cachedUser);
                await loadInvitations(userData.id);
              }
            } catch (error) {
              console.error("Error checking invitations:", error);
            }
          };
          checkInvites();
        }
      } else {
        checkAuth();
      }
    }, 240000);

    return () => {
      if (tokenCheckTimer.current) {
        clearInterval(tokenCheckTimer.current);
      }
    };
  }, [currentPageName]);

  useEffect(() => {
    const hasOpenModal = document.querySelector('[role="dialog"]');
    
    if (hasOpenModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  if ((window.location.pathname === "/" || currentPageName === "") && isLoggedIn && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (currentPageName === "Landing" || currentPageName === "Onboarding") {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  const handleLogout = async () => {
    try {
      await User.logout();
      localStorage.removeItem('userProfile');
      localStorage.removeItem('userData');
      setIsLoggedIn(false);
      setUser(null);
      setUserProfile(null);
      showToast("Logged out successfully");
      navigate(createPageUrl("Landing"));
    } catch (error) {
      showToast(
        "Error logging out",
        "Please try again",
        "destructive"
      );
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const navItems = [
    {
      name: t('nav_home'),
      icon: <HomeIcon className="h-5 w-5" />,
      path: createPageUrl("Dashboard"),
      active: currentPageName === "Dashboard"
    },
    {
      name: t('nav_topics'),
      icon: <Bookmark className="h-5 w-5" />,
      path: createPageUrl("Topics"),
      active: currentPageName === "Topics"
    },
    {
      name: t('nav_community'),
      icon: <Users className="h-5 w-5" />,
      path: createPageUrl("Community"),
      active: currentPageName === "Community"
    },
    {
      name: t('nav_conversations'),
      icon: (
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          {pendingInvitations.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {pendingInvitations.length}
            </div>
          )}
        </div>
      ),
      path: createPageUrl("Conversations"),
      active: currentPageName === "Conversations"
    },
    {
      name: t('nav_top_conversations'),
      icon: <Sparkles className="h-5 w-5" />,
      path: createPageUrl("TopConversations"),
      active: currentPageName === "TopConversations"
    },
    {
      name: t('nav_achievements'),
      icon: <Award className="h-5 w-5" />,
      path: createPageUrl("Achievements"),
      active: currentPageName === "Achievements"
    },
    {
      name: t('nav_profile'),
      icon: <UserIcon className="h-5 w-5" />,
      path: createPageUrl("Profile"),
      active: currentPageName === "Profile"
    }
  ];

  if (user?.role === "admin") {
    navItems.push({
      name: t('nav_manage_topics'),
      icon: <Settings className="h-5 w-5" />,
      path: createPageUrl("AdminTopics"),
      active: currentPageName === "AdminTopics"
    });
  }

  if (isLoading && !loadingTimeout) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col ${direction === 'rtl' ? 'rtl' : 'ltr'}`}>
      
      <style jsx global>{`
        
        .radix-dropdown-content,
        [data-radix-popper-content-wrapper] {
          z-index: 9999 !important;
        }
        
        
        .dropdown-menu[data-state="open"] {
          z-index: 100;
        }
        
        .dropdown-menu-content {
          z-index: 100;
        }
      `}</style>
      
      <header className="bg-white shadow-sm py-2 px-4 flex justify-between items-center lg:hidden z-50 header-nav fixed top-0 left-0 right-0">
        <Link to={createPageUrl("Topics")} className="flex items-center">
          <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'mr-4' : 'ml-2'}`}>
            <img 
              src="https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png" 
              alt="Clarify Logo" 
              className="w-8 h-8"
            />
            <span className={`font-bold text-gray-800 ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}>{t('app_name')}</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSelector variant="ghost" />
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleMenu}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </header>

      <div className="pt-14 lg:pt-0 flex-1 flex relative">
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={closeMenu}
          ></div>
        )}

        <aside className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full overflow-visible">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <Link to={createPageUrl("Topics")} className="flex items-center space-x-2">
                  <img 
                    src="https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png" 
                    alt="Clarify Logo" 
                    className="w-10 h-10 relative top-[2px]"
                  />
                  <span className="text-gray-800 px-2 text-xl font-bold">{t('app_name')}</span>
                </Link>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={closeMenu}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {userProfile && (
              <div className="p-4 border-b">
                <Avatar 
                  user={userProfile} 
                  size="lg"
                  className="mx-auto"
                />
                <div className="mt-3 text-center">
                  <div className="font-medium text-gray-900">{userProfile.display_name}</div>
                  <div className="text-sm text-gray-500">Level {userProfile.level || 1}</div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Level Progress</span>
                    <span>
                      {userProfile.total_points ? `${userProfile.total_points % 100}/100` : "0/100"} points
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-300" 
                      style={{ 
                        width: userProfile.total_points ? `${userProfile.total_points % 100}%` : "0%" 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        item.active
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      } ${direction === 'rtl' ? 'space-x-reverse' : ''}`}
                      onClick={closeMenu}
                    >
                      <div className={`flex-shrink-0 ${direction === 'rtl' ? 'ml-3' : 'mr-3'}`}>
                        {item.icon}
                      </div>
                      <span>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            
            <div className="p-4 border-t flex flex-col gap-3">
              
              <div className="hidden lg:block">
                <LanguageSelector 
                  variant="outline" 
                  className="w-full text-sm text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50" 
                />
              </div>
              
              <Button 
                variant="outline" 
                className="w-full flex items-center justify-center space-x-2 text-gray-700"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span>{t('logout')}</span>
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 overflow-x-hidden overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      <NotificationPermission />
      <PushNotificationManager />
      
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          className: "!bg-white !border-2 !shadow-lg !rounded-lg",
          style: {
            background: 'white',
            color: '#111827',
            padding: '16px',
            maxWidth: '90vw',
            width: '400px',
            marginBottom: '16px'
          }
        }}
      />
    </div>
  );
}

