import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  CheckCircle2, 
  Star,
  ThumbsUp,
  X 
} from "lucide-react";
import { User } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { TopicOpinion } from "@/api/entities";
import { useAppToast } from "@/components/utils/toast";

export default function CompletionDialog({ 
  conversation,
  topic,
  onComplete,
  onCancel,
  userScore = { empathy: 0, clarity: 0, open_mindedness: 0, total: 0 },
  isAccepting = false
}) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useAppToast();

  const handleSubmitCompletion = async () => {
    setIsSubmitting(true);
    
    try {
      // First check if user profile exists
      const currentUser = await User.me();
      const userProfiles = await UserProfile.filter({ user_id: currentUser.id });
      
      if (userProfiles.length === 0) {
        // No profile found, create a basic one
        console.log("Creating user profile for points award");
        await UserProfile.create({
          user_id: currentUser.id,
          display_name: currentUser.full_name || "User",
          level: 1,
          total_points: 0,
          conversations_completed: 0,
          badges: ["newcomer"],
          highest_scores: {
            empathy: 0,
            clarity: 0,
            open_mindedness: 0
          }
        });
      }
      
      // Continue with completion and point awarding
      const updatedConv = await Conversation.update(conversation.id, {
        status: "completed",
        ended_at: new Date().toISOString(),
        completion_feedback: [
          ...conversation.completion_feedback || [],
          {
            user_id: currentUser.id,
            feedback: feedback,
            timestamp: new Date().toISOString()
          }
        ]
      });
      
      // Update user opinion data if available
      try {
        const opinions = await TopicOpinion.filter({ 
          user_id: currentUser.id, 
          topic_id: conversation.topic_id 
        });
        
        if (opinions.length > 0) {
          const opinion = opinions[0];
          await TopicOpinion.update(opinion.id, {
            completed_conversations: (opinion.completed_conversations || 0) + 1
          });
        }
      } catch (err) {
        console.error("Error updating topic opinion:", err);
      }
      
      // Show feedback modal
      onComplete(updatedConv);
      
    } catch (error) {
      console.error("Error completing conversation:", error);
      showToast(
        "Error completing conversation",
        "Please try again",
        "destructive"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isAccepting ? "Accept Completion" : "Complete Conversation"}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isAccepting 
                  ? "Share your final thoughts to complete the conversation"
                  : "Request to complete this conversation"
                }
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Score summary */}
          <div className="bg-indigo-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-5 w-5 text-indigo-600" />
              <h3 className="font-medium text-indigo-900">Your Performance</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-indigo-600">
                  {userScore.empathy}
                </div>
                <div className="text-xs text-gray-600">Empathy</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-indigo-600">
                  {userScore.clarity}
                </div>
                <div className="text-xs text-gray-600">Clarity</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-indigo-600">
                  {userScore.open_mindedness}
                </div>
                <div className="text-xs text-gray-600">Open Mind</div>
              </div>
            </div>
            <div className="mt-3 text-center">
              <Badge variant="outline" className="bg-white">
                Total Score: {userScore.total}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Final Thoughts
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share what you learned from this conversation..."
                className="h-32"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleSubmitCompletion}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {isAccepting ? "Accept & Complete" : "Request Completion"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}