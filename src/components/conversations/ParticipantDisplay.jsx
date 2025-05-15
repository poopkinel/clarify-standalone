import React from "react";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from "@/components/utils/i18n";
import { Badge } from "@/components/ui/badge";

export default function ParticipantDisplay({ participant1, participant2, topic }) {
  const { t, direction } = useLanguage();
  
  // Fallback display objects for missing participants
  const participant1Display = participant1 || {
    display_name: t("Unknown participant"),
    avatar_color: "#cccccc"
  };
  
  const participant2Display = participant2 || {
    display_name: t("Unknown participant"),
    avatar_color: "#cccccc"
  };
  
  return (
    <div className={`p-5 border-t border-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
      <div className={`flex items-center gap-3 mb-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
        <span className="text-gray-500 text-sm">{t("Between")}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Avatar user={participant1Display} size="md" />
          <div>
            <div className="font-medium">{participant1Display.display_name}</div>
            {participant1?.level && (
              <div className="text-xs text-gray-500">
                <span>{t("Level")} {participant1.level}</span>
                {participant1.total_points && (
                  <span> · {participant1.total_points} {t("points")}</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className={`flex items-center ${direction === 'rtl' ? 'mr-2 ml-2' : 'mx-2'}`}>
          <span className="text-gray-400">{t("and")}</span>
        </div>
        
        <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Avatar user={participant2Display} size="md" />
          <div>
            <div className="font-medium">{participant2Display.display_name}</div>
            {participant2?.level && (
              <div className="text-xs text-gray-500">
                <span>{t("Level")} {participant2.level}</span>
                {participant2.total_points && (
                  <span> · {participant2.total_points} {t("points")}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Topic information */}
      {topic && (
        <div className={`mt-4 flex items-center text-sm ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <div className="text-gray-600 mr-2">{t("Topic")}:</div>
          <Badge variant="outline" className="font-normal">
            {topic.title}
          </Badge>
          {topic.category && (
            <Badge 
              variant="secondary" 
              className={`${direction === 'rtl' ? 'mr-2' : 'ml-2'} font-normal text-xs`}
            >
              {topic.category}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}