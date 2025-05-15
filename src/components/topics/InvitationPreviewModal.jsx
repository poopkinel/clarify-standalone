
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Clock, AlertCircle } from "lucide-react";
import Avatar from "@/components/ui/avatar";
import { useLanguage } from "@/components/utils/i18n";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function InvitationPreviewModal({
  isOpen,
  onClose,
  topic,
  invitations,
  onAccept,
  isAccepting
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleAccept = async (conversation) => {
    try {
      // Accept the invitation using the existing onAccept handler
      await onAccept(conversation);

      // If successful, redirect to the conversation page
      if (conversation?.id) {
        navigate(createPageUrl(`ChatView?id=${conversation.id}`));
      }

      // Close the modal
      onClose();
    } catch (error) {
      console.error("Error accepting invitation:", error);
    }
  };

  if (!topic || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-0">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-xl text-gray-900">
            {t('choose_discussion_partner')}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {t('select_invitation_to_accept_for')} "{topic.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {invitations.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                <p className="text-gray-600">{t('no_active_invitations_found')}</p>
              </div>
            ) : (
              invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      user={invitation.sender}
                      size="lg"
                      className="flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {invitation.sender?.display_name || t('unknown_user')}
                        </h3>
                        <Badge variant="outline" className="bg-gray-50">
                          {t('level')} {invitation.sender?.level || 1}
                        </Badge>
                      </div>

                      <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                        <Clock className="h-3 w-3" />
                        <span>
                          {t('invited')} {new Date(invitation.conversation.created_date).toLocaleString()}
                        </span>
                      </div>

                      <Button
                        onClick={() => handleAccept(invitation.conversation)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2"
                        disabled={isAccepting}
                      >
                        {isAccepting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          t('accept_invitation')
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
