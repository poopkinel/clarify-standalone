
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/utils/i18n';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import Avatar from "@/components/ui/avatar";
import { Conversation } from "@/api/entities";

export default function PendingInvitationsList({ invitations, onReject }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [processingId, setProcessingId] = React.useState(null);
  
  const handleAccept = async (invitation) => {
    try {
      setProcessingId(invitation.conversation.id);
      
      // Update conversation status
      const updatedConversation = await Conversation.update(invitation.conversation.id, {
        status: "waiting"
      });
      
      // Fix: Use the correct URL path for ChatView
      navigate(`${createPageUrl("ChatView")}?id=${invitation.conversation.id}`);
      
    } catch (error) {
      console.error("Error accepting invitation:", error);
    } finally {
      setProcessingId(null);
    }
  };
  
  return (
    <div className="w-full max-w-[calc(100vw-24px)] md:max-w-none">
      <Card className="bg-gradient-to-r from-pink-50 to-rose-50 border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-base flex items-center gap-1 text-rose-900">
            {t("Pending Invitations")} ({invitations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <Card key={invitation.conversation.id} className="overflow-hidden">
                <CardContent className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar user={invitation.sender} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{invitation.sender?.display_name}</div>
                      <div className="text-xs text-gray-500">Level {invitation.sender?.level || 1}</div>
                    </div>
                  </div>
                  <div className="text-xs mb-2 line-clamp-1">{invitation.topic?.title}</div>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      onClick={() => handleAccept(invitation)}
                      className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs"
                      disabled={processingId === invitation.conversation.id}
                    >
                      {processingId === invitation.conversation.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        t("Accept")
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onReject(invitation)}
                      className="h-7 text-xs"
                      disabled={processingId === invitation.conversation.id}
                    >
                      {t("Decline")}
                    </Button>
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
