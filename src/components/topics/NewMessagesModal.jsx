import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, X } from "lucide-react";
import Avatar from "@/components/ui/avatar";

const NewMessagesModal = ({ 
  isOpen, 
  onClose, 
  topic, 
  conversations = [],
  onSelectConversation
}) => {
  if (!isOpen || !topic) return null;
  
  const totalNewMessages = conversations.reduce(
    (total, conv) => total + (conv.newMessagesCount || 0), 
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-0">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Mail className="h-5 w-5 text-blue-500" />
            New Messages {totalNewMessages > 0 && `(${totalNewMessages})`}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Choose a conversation to view new messages for topic: {topic.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[350px] overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-gray-500">No conversations with new messages</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="border rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectConversation(conversation)}
                >
                  <div className="flex items-center gap-3">
                    {conversation.participant && (
                      <Avatar user={conversation.participant} size="sm" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {conversation.participant?.display_name || "Anonymous User"}
                      </p>
                      <div className="flex items-center text-sm text-gray-500 gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>
                          {conversation.lastMessagePreview
                            ? `"${conversation.lastMessagePreview.substring(0, 30)}${
                                conversation.lastMessagePreview.length > 30 ? '...' : ''
                              }"`
                            : "New messages"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {conversation.newMessagesCount > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {conversation.newMessagesCount} new
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-4 pt-3 border-t">
          <Button variant="outline" onClick={onClose} className="text-gray-700">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewMessagesModal;