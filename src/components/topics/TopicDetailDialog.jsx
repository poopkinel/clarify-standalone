
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, X, Edit, MessageCircle } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { Topic } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TopicDetailDialog({
  topicId,
  isOpen,
  onClose,
  onOpenOpinionDialog,
  onFindPartners,
  userOpinion,
  userId
}) {
  const { t, direction } = useLanguage();
  const [topic, setTopic] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [opinions, setOpinions] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [conversations, setConversations] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const location = useLocation();

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen && topicId) {
      setIsLoading(true);
      loadTopicData();
    }
  }, [isOpen, topicId]);

  const loadTopicData = async () => {
    if (!topicId) {
      setIsLoading(false);
      return;
    }

    try {
      // Load topic data
      const topicData = await Topic.get(topicId);
      setTopic(topicData);

      // Load opinions and conversations in parallel
      const [opinionData, conversationData] = await Promise.all([
        TopicOpinion.filter({ topic_id: topicId }),
        Conversation.filter({ topic_id: topicId })
      ]);
      
      setOpinions(opinionData);
      setConversations(conversationData);

      // Load user profiles if necessary
      if (opinionData.length > 0) {
        const userIds = [...new Set(opinionData.map(o => o.user_id))];
        const profiles = {};
        
        for (const uid of userIds) {
          try {
            const userProfileData = await UserProfile.filter({ user_id: uid });
            if (userProfileData.length > 0) {
              profiles[uid] = userProfileData[0];
            }
          } catch (e) {
            console.error("Error loading user profile:", e);
          }
        }
        
        setUserProfiles(profiles);
      }
    } catch (error) {
      console.error("Error loading topic data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    try {
      // Use the custom domain for the share URL
      const customDomain = "https://clarify-app.com";
      const shareUrl = `${customDomain}${createPageUrl("Topics")}?dialog=${topicId}`;
      
      // First try the Web Share API with error handling
      if (navigator.share && typeof navigator.share === 'function') {
        navigator.share({
          title: topic?.title || 'Topic Discussion',
          text: topic?.description || 'Check out this discussion topic',
          url: shareUrl
        }).catch(err => {
          console.log("Share API error, falling back to clipboard", err);
          copyToClipboard(shareUrl);
        });
      } else {
        // Fallback to copying to clipboard
        copyToClipboard(shareUrl);
      }
    } catch (error) {
      console.error("Share error:", error);
      // Final fallback - alert with the URL using the custom domain
      alert(`Copy this link to share: https://clarify-app.com${createPageUrl("Topics")}?dialog=${topicId}`);
    }
  };
  
  const copyToClipboard = (url) => {
    try {
      // Copy URL to clipboard
      navigator.clipboard.writeText(url)
        .then(() => {
          // Show success feedback
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(err => {
          console.error("Clipboard API error:", err);
          // Try a final fallback
          const textarea = document.createElement('textarea');
          textarea.value = url;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        });
    } catch (e) {
      console.error("Copy to clipboard error:", e);
    }
  };

  const openOpinionDialog = () => {
    if (onOpenOpinionDialog && topic) {
      onClose();
      setTimeout(() => {
        onOpenOpinionDialog(topic);
      }, 100);
    }
  };

  if (!isOpen) return null;

  const getStanceDistribution = () => {
    const distribution = {
      strongly_agree: 0,
      agree: 0,
      neutral: 0,
      disagree: 0,
      strongly_disagree: 0
    };

    opinions.forEach(opinion => {
      if (distribution.hasOwnProperty(opinion.stance)) {
        distribution[opinion.stance]++;
      }
    });

    return distribution;
  };

  const distribution = getStanceDistribution();
  const totalOpinions = opinions.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-100 p-0 fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-w-3xl overflow-hidden rounded-lg max-h-[85vh]">
        {isLoading || !topic ? (
          <div className="animate-pulse p-6">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
            <div className="h-20 bg-gray-200 rounded mb-4"></div>
          </div>
        ) : (
          <>
            {/* Header with image background */}
            <div className="relative h-72 bg-cover bg-center" style={{ backgroundImage: `url(${topic.image_url || `https://source.unsplash.com/1200x400/?${encodeURIComponent(topic.title)}`})` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80">
                <div className="absolute top-0 left-0 right-0 flex justify-between p-4">
                  <div className="flex flex-wrap gap-2">
                    {topic.tags && topic.tags.map(tag => (
                      <Badge key={tag} className="bg-white/80 text-black text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      id="share-button"
                      size="sm" 
                      variant={copySuccess ? "success" : "ghost"} 
                      className={`text-white ${copySuccess ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-white/20'}`} 
                      onClick={handleShare}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      {copySuccess ? t('Link copied!') : t('Share')}
                    </Button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-3xl font-bold text-white mb-2">{topic.title}</h2>
                  <p className="text-white/90 mb-4 line-clamp-2">{topic.description}</p>
                </div>
              </div>
            </div>

            {/* Content Area - Simplified without tabs */}
            <div className="flex flex-col h-[calc(85vh-18rem)]"> {/* Subtract header height */}
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column - Description */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">{t('Description')}</h3>
                      <p className="text-gray-700">{topic.description}</p>
                    </div>

                    {/* Your Opinion */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium">{t('Your Opinion')}</h3>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-indigo-600"
                          onClick={openOpinionDialog}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {t('Edit Opinion')}
                        </Button>
                      </div>

                      {userOpinion ? (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <Badge 
                            className={
                              userOpinion.stance === 'strongly_agree' || userOpinion.stance === 'agree'
                                ? 'bg-green-100 text-green-800'
                                : userOpinion.stance === 'neutral'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {t(userOpinion.stance)}
                          </Badge>
                          <p className="mt-2 text-gray-700">{userOpinion.reasoning}</p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-gray-500">{t('Share your perspective on this topic')}</p>
                          <Button 
                            onClick={openOpinionDialog}
                            className="mt-2 bg-indigo-600 hover:bg-indigo-700"
                          >
                            {t('Share Opinion')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Stats */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">{t('Stats')}</h3>
                      <div className="space-y-3">
                        <div className="bg-white border border-blue-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                          <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-full mr-3">
                              <MessageCircle className="h-5 w-5 text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900">{t('Opinions')}</span>
                          </div>
                          <span className="text-xl font-semibold text-gray-900">{opinions.length}</span>
                        </div>

                        <div className="bg-white border border-green-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                          <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-full mr-3">
                              <MessageCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <span className="font-medium text-gray-900">{t('Active Conversations')}</span>
                          </div>
                          <span className="text-xl font-semibold text-gray-900">
                            {conversations.filter(c => c.status === 'active').length}
                          </span>
                        </div>

                        <div className="bg-white border border-purple-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                          <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-full mr-3">
                              <MessageCircle className="h-5 w-5 text-purple-600" />
                            </div>
                            <span className="font-medium text-gray-900">{t('Total Conversations')}</span>
                          </div>
                          <span className="text-xl font-semibold text-gray-900">{conversations.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Opinion Distribution */}
                    {opinions.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-3 text-gray-900">{t('Opinion Distribution')}</h3>
                        <div className="space-y-2 bg-white border rounded-lg p-4">
                          {Object.entries(distribution).map(([stance, count]) => (
                            <div key={stance} className="flex items-center">
                              <div className="w-32 text-sm font-medium text-gray-700">{t(stance)}</div>
                              <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    stance.includes('agree') ? 'bg-green-500' : 
                                    stance === 'neutral' ? 'bg-blue-500' : 
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${totalOpinions ? (count / totalOpinions) * 100 : 0}%` }}
                                ></div>
                              </div>
                              <div className="w-20 text-right text-sm font-medium text-gray-700">
                                {count} ({totalOpinions ? Math.round((count / totalOpinions) * 100) : 0}%)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed footer with action buttons */}
              <div className="flex-shrink-0 p-4 border-t bg-gray-50">
                <div className="flex justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                  >
                    {t('Close')}
                  </Button>
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                      onClose();
                      if (onFindPartners && topic) {
                        onFindPartners(topic);
                      }
                    }}
                  >
                    {t('Find Discussion Partners')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
