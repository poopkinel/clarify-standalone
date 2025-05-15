import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from "@/components/utils/i18n";
import { getRelativeTimeString } from "@/components/utils/helpers";
import { TopicOpinion } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { X } from "lucide-react";

export default function StatsDialog({
  topicId,
  statType,
  isOpen,
  onClose,
  onInvite,
  userId
}) {
  const { t } = useLanguage();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState({});
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen && topicId) {
      loadData();
    }
  }, [isOpen, topicId, statType]);

  const loadData = async () => {
    if (!topicId) return;
    
    setIsLoading(true);
    try {
      let items = [];
      
      if (statType === 'opinions') {
        items = await TopicOpinion.filter({ topic_id: topicId });
      } else if (statType === 'totalConversations') {
        items = await Conversation.filter({ topic_id: topicId });
      } else if (statType === 'activeConversations') {
        items = await Conversation.filter({ 
          topic_id: topicId,
          status: "active"
        });
      }

      // Load user profiles for the items
      const userIds = new Set();
      items.forEach(item => {
        if (statType === 'opinions') {
          userIds.add(item.user_id);
        } else {
          userIds.add(item.participant1_id);
          userIds.add(item.participant2_id);
        }
      });

      const profiles = {};
      for (const uid of userIds) {
        if (uid) {
          try {
            const userProfileData = await UserProfile.filter({ user_id: uid });
            if (userProfileData.length > 0) {
              profiles[uid] = userProfileData[0];
            }
          } catch (e) {
            console.error("Error loading user profile:", e);
          }
        }
      }

      setUserProfiles(profiles);
      setData(items);
    } catch (error) {
      console.error("Error loading stats data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItemContent = (item) => {
    if (statType === 'opinions') {
      const user = userProfiles[item.user_id];
      return (
        <div className="flex items-start gap-3">
          <Avatar 
            user={user} 
            size="md"
            className="flex-shrink-0"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {user?.display_name || t('Anonymous User')}
                </span>
                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                  {t('Level')} {user?.level || 1}
                </Badge>
              </div>
              <span className="text-sm text-gray-500">
                {getRelativeTimeString(item.created_date)}
              </span>
            </div>

            <Badge 
              className={`mb-2 ${
                item.stance === 'strongly_agree' || item.stance === 'agree'
                  ? 'bg-green-100 text-green-800'
                  : item.stance === 'neutral'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {t(item.stance)}
            </Badge>
            <p className="text-gray-700">{item.reasoning}</p>
            
            {item.user_id !== userId && (
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={() => onInvite(item.user_id)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {t('Invite to Discussion')}
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      const participant1 = userProfiles[item.participant1_id];
      const participant2 = userProfiles[item.participant2_id];
      
      return (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={
              item.status === 'completed' ? "bg-green-100 text-green-800" :
              item.status === 'active' ? "bg-blue-100 text-blue-800" :
              "bg-gray-100 text-gray-800"
            }>
              {t(item.status)}
            </Badge>
            <span className="text-sm text-gray-500">
              {getRelativeTimeString(item.created_date)}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar user={participant1} size="sm" />
                <span className="text-sm font-medium">
                  {participant1?.display_name || t('User')} 
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {participant2?.display_name || t('User')}
                </span>
                <Avatar user={participant2} size="sm" />
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm">
              {t('View')}
            </Button>
          </div>
        </div>
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-hidden">
      <div 
        ref={dialogRef}
        className="relative w-full max-w-lg bg-white rounded-lg shadow-lg flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {statType === 'opinions' && t('All Opinions')}
            {statType === 'totalConversations' && t('All Conversations')}
            {statType === 'activeConversations' && t('Active Conversations')}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-gray-100 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {statType === 'opinions' && t('No opinions yet')}
                {statType === 'totalConversations' && t('No conversations yet')}
                {statType === 'activeConversations' && t('No active conversations')}
              </div>
            ) : (
              <div className="space-y-4">
                {data.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors"
                  >
                    {renderItemContent(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full"
          >
            {t('Close')}
          </Button>
        </div>
      </div>
    </div>
  );
}