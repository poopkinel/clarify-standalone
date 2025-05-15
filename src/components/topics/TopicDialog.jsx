
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, X } from "lucide-react";
import { User } from "@/api/entities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/utils/i18n";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Conversation } from "@/api/entities";
import { useToast } from "@/components/ui/use-toast";

const STANCE_OPTIONS = [
  { value: "strongly_agree", numeric: 5, label: "strongly_agree", color: "bg-green-600 hover:bg-green-700" },
  { value: "agree", numeric: 4, label: "agree", color: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "neutral", numeric: 3, label: "neutral", color: "bg-blue-600 hover:bg-blue-700" },
  { value: "disagree", numeric: 2, label: "disagree", color: "bg-amber-600 hover:bg-amber-700" },
  { value: "strongly_disagree", numeric: 1, label: "strongly_disagree", color: "bg-red-600 hover:bg-red-700" }
];

export default function TopicDialog({ topic, onClose, onSave, userOpinion }) {
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Convert initial numeric stance to string value if needed
  const getInitialStance = () => {
    if (!userOpinion?.stance) return "neutral";
    if (typeof userOpinion.stance === 'number') {
      const stanceMap = {
        5: "strongly_agree",
        4: "agree",
        3: "neutral",
        2: "disagree",
        1: "strongly_disagree"
      };
      return stanceMap[userOpinion.stance] || "neutral";
    }
    return userOpinion.stance;
  };

  const [stance, setStance] = useState(getInitialStance());
  const [reasoning, setReasoning] = useState(userOpinion?.reasoning || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (reasoning.trim().length < 10) {
      setError(t("reasoning_required"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Check authentication first
      const user = await User.me();
      if (!user?.id) {
        setError(t("please_login"));
        setIsSubmitting(false);
        return;
      }

      // Find the numeric value for the current stance
      const option = STANCE_OPTIONS.find(opt => opt.value === stance);
      const success = await onSave(option.numeric, reasoning);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Error in TopicDialog:", error);
      setError(t("error_saving_opinion"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptInvitation = async (invitation) => {
    try {
      setIsAccepting(true);
      
      const userId = (await User.me()).id;

      // Accept the invitation
      const updatedConversation = await Conversation.update(invitation.id, {
        status: "waiting",
        participant2_id: userId
      });

      // If successful, redirect to the conversation
      if (updatedConversation?.id) {
        navigate(createPageUrl(`ChatView?id=${updatedConversation.id}`));
      }

      // Close the dialog
      onClose();
      
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({
        title: t("Error accepting invitation"),
        description: t("Please try again later"),
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-md bg-white max-h-[90vh] overflow-y-auto ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900">
            {topic.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            {topic.description}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">
              {t("your_stance")}:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {STANCE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  onClick={() => setStance(option.value)}
                  className={`w-full py-4 text-base font-medium transition-colors ${
                    stance === option.value 
                      ? `${option.color} text-white`
                      : "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200"
                  }`}
                >
                  {t(option.label)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reasoning" className="block text-sm font-medium text-gray-900">
              {t("explain_your_reasoning")}
            </Label>
            <Textarea
              id="reasoning"
              placeholder={t("share_why_you_hold_this_position")}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              className="min-h-[100px] w-full px-3 py-2 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              dir={direction}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
            >
              {t("cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("submitting")}
                </>
              ) : (
                t("share_opinion")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
