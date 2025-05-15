import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '@/components/utils/i18n';
import Avatar from "@/components/ui/avatar";
import { Clock } from "lucide-react";
import { Topic } from "@/api/entities"; // Add Topic import

export default function ActiveInvitationsList({ invitations }) {
  const { t } = useLanguage();
  const [topics, setTopics] = React.useState({});

  // Load topics for the invitations
  React.useEffect(() => {
    const loadTopics = async () => {
      const topicsMap = {};
      
      // Get unique topic IDs
      const topicIds = [...new Set(invitations.map(inv => inv.topic_id))];
      
      // Load each topic
      for (const topicId of topicIds) {
        try {
          const topic = await Topic.get(topicId);
          topicsMap[topicId] = topic;
        } catch (error) {
          console.error(`Error loading topic ${topicId}:`, error);
          topicsMap[topicId] = { title: t("Topic Unavailable") };
        }
      }
      
      setTopics(topicsMap);
    };

    if (invitations.length > 0) {
      loadTopics();
    }
  }, [invitations]);
  
  return (
    <div className="w-full max-w-[calc(100vw-24px)] md:max-w-none">
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-base flex items-center gap-1 text-indigo-900">
            {t("Active Invitations")} ({invitations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <Card key={invitation.id} className="overflow-hidden">
                <CardContent className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar user={invitation.participant} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {invitation.participant?.display_name || t("Unknown")}
                      </div>
                      {/* Add topic title */}
                      <div className="text-xs text-gray-600 truncate">
                        {topics[invitation.topic_id]?.title || t("Loading topic...")}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="inline-block h-3 w-3" />
                        <span className="truncate">{t("Waiting for response...")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}