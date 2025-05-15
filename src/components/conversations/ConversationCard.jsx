import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MessageCircle, CheckCircle, Users } from "lucide-react";
import { format } from "date-fns";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from '@/components/utils/i18n';

export default function ConversationCard({ 
  conversation, 
  topic, 
  otherParticipant, 
  userId 
}) {
  const { t, direction } = useLanguage();
  
  // Fallback profile display
  const otherParticipantDisplay = otherParticipant || {
    display_name: t("Unknown participant"),
    avatar_color: "#cccccc"
  };

  const getConversationStatusClass = (status) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "abandoned":
        return "bg-gray-100 text-gray-600 border-gray-200";
      case "invited":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "completion_requested":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "waiting_completion":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getConversationStatusIcon = (status) => {
    switch (status) {
      case "waiting":
        return <Clock className="h-4 w-4" />;
      case "active":
        return <MessageCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "invited":
        return <Users className="h-4 w-4" />;
      case "completion_requested":
        return <Clock className="h-4 w-4" />;
      case "waiting_completion":
        return <Clock className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };
  
  // Timer information display
  const hasTimer = conversation.expires_at != null;
  let timeRemaining = null;
  let isExpiringSoon = false;
  
  if (hasTimer) {
    const now = new Date();
    const expiry = new Date(conversation.expires_at);
    timeRemaining = expiry - now;
    isExpiringSoon = timeRemaining > 0 && timeRemaining < 60 * 60 * 1000; // Less than 1 hour
  }
  
  const formatTimeRemaining = (ms) => {
    if (ms <= 0) return t("Expired");
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return t("{{days}}d {{hours}}h remaining", { days, hours: hours % 24 });
    } else if (hours > 0) {
      return t("{{hours}}h {{minutes}}m remaining", { hours, minutes: minutes % 60 });
    } else {
      return t("{{minutes}}m remaining", { minutes });
    }
  };

  // Get the title from topic or use a fallback
  const getTitle = () => {
    return topic?.title || t("Topic Unavailable");
  };
  
  // Get user score (if any)
  const getUserScore = () => {
    return conversation.participant1_id === userId
      ? conversation.participant1_score
      : conversation.participant2_score;
  };
  
  const userScore = getUserScore();

  return (
    <Card className={`bg-white hover:shadow-md transition-all duration-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
      <CardContent className="p-4">
        <div className={`flex justify-between items-start mb-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-medium text-gray-900 line-clamp-1 mr-2">
            {getTitle()}
          </h3>
          <Badge
            className={`flex-shrink-0 flex items-center gap-1 ml-2 border ${getConversationStatusClass(conversation.status)} ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}
          >
            {getConversationStatusIcon(conversation.status)}
            <span className="capitalize">
              {t(conversation.status)}
            </span>
          </Badge>
        </div>
        
        <div className={`flex items-center mb-1 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <div className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}>
            <Avatar user={otherParticipantDisplay} size="sm" />
          </div>
          <span className="text-sm text-gray-600">{otherParticipantDisplay.display_name}</span>
          
          {conversation.started_at && (
            <span className={`text-xs text-gray-500 ${direction === 'rtl' ? 'mr-auto' : 'ml-auto'}`}>
              {new Date(conversation.started_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Timer indicator */}
        {hasTimer && timeRemaining > 0 && (
          <div className={`mt-2 flex items-center gap-2 px-2 py-1 rounded-md text-xs ${
            isExpiringSoon ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          } ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Clock className="h-3 w-3" />
            <span>{formatTimeRemaining(timeRemaining)}</span>
          </div>
        )}
        
        {conversation.auto_completed && (
          <div className={`mt-2 flex items-center gap-2 px-2 py-1 rounded-md text-xs bg-gray-50 text-gray-700 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Clock className="h-3 w-3" />
            <span>{t("Auto-completed by timer")}</span>
          </div>
        )}
        
        {userScore?.total > 0 && (
          <div className={`mt-2 flex items-center text-sm ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <div className={direction === 'rtl' ? 'flex-row-reverse' : ''}>
              <div className="flex items-center">
                <span className="text-gray-700">{t("Score")}: </span>
                <Badge variant="outline" className={`${direction === 'rtl' ? 'mr-1' : 'ml-1'} font-medium`}>
                  <span>{userScore.total || 0}</span>
                  <span className={direction === 'rtl' ? 'mr-1' : 'ml-1'}>{t("pts")}</span>
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}