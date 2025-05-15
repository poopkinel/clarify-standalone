
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Topic } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  Info, 
  X 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/components/utils/toast";
import { useLanguage } from '@/components/utils/i18n';
import MatchFinderWizard from "../components/matching/MatchFinderWizard";
import PendingInvitationsList from "../components/matching/PendingInvitationsList";
import ActiveInvitationsList from "../components/matching/ActiveInvitationsList";

export default function FindPartners() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const preSelectedTopicId = urlParams.get('topicId');
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useAppToast();
  const [activeInvitations, setActiveInvitations] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState(preSelectedTopicId || null);
  const { t, direction } = useLanguage();
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // Update loadActiveInvitations function
  const loadActiveInvitations = async () => {
    try {
      const user = await User.me();
      const conversations = await Conversation.filter({
        participant1_id: user.id,
        status: "invited"
      });
      
      // Load participant profiles and include topic_id in the result
      const invitationsWithProfiles = await Promise.all(
        conversations.map(async (conv) => {
          const profiles = await UserProfile.filter({ user_id: conv.participant2_id });
          return {
            ...conv,
            participant: profiles[0],
            topic_id: conv.topic_id // Make sure topic_id is included
          };
        })
      );
      
      setActiveInvitations(invitationsWithProfiles);
    } catch (error) {
      console.error("Error loading active invitations:", error);
    }
  };

  useEffect(() => {
    loadInvitations();
    loadActiveInvitations();
    
    // If a topic ID was passed in the URL, make sure the matcher
    // is initialized with this topic selected
    if (preSelectedTopicId) {
      setSelectedTopicId(preSelectedTopicId);
      loadTopicDetails(preSelectedTopicId);
    }
  }, [preSelectedTopicId]);

  const loadTopicDetails = async (topicId) => {
    try {
      const topic = await Topic.get(topicId);
      setSelectedTopic(topic);
    } catch (error) {
      console.error("Error loading topic details:", error);
    }
  };

  const loadInvitations = async () => {
    try {
      const user = await User.me();

      const invitedConversations = await Conversation.filter({
        participant2_id: user.id,
        status: "invited",
      });

      // Load topic and sender details for each invitation
      const invitationsWithDetails = await Promise.all(
        invitedConversations.map(async (conv) => {
          const [topic, senderProfiles] = await Promise.all([
            Topic.get(conv.topic_id),
            UserProfile.filter({ user_id: conv.participant1_id }),
          ]);

          return {
            conversation: conv,
            topic,
            sender: senderProfiles[0] || null,
          };
        })
      );

      setPendingInvitations(invitationsWithDetails);
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
    setIsLoading(false);
  };

  const handleRejectInvitation = async (invitation) => {
    try {
      await Conversation.update(invitation.conversation.id, {
        status: "rejected",
      });

      showToast(t("Invitation declined"));

      setPendingInvitations((prev) =>
        prev.filter(
          (inv) => inv.conversation.id !== invitation.conversation.id
        )
      );
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      showToast(t("Error"), t("Please try again later"), "destructive");
    }
  };

  const handleMatchFound = (conversation) => {
    if (conversation?.id) {
      navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Header - Narrower container on mobile */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm shadow-sm border-b">
        <div className="w-full max-w-[100vw] mx-auto px-3 md:max-w-screen-xl md:px-4">
          <div className="flex items-center h-14 md:h-16">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Topics"))}
              className="h-8 w-8 mr-2 flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-xl font-bold text-gray-900 flex items-center gap-2 truncate">
                {t("Find Partners")}
                {pendingInvitations.length > 0 && (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200">
                    {pendingInvitations.length}
                  </Badge>
                )}
              </h1>
              {selectedTopic && (
                <div className="text-xs md:text-sm text-gray-500 truncate">{selectedTopic.title}</div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTutorial(!showTutorial)}
              className="h-8 w-8 flex-shrink-0"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content - Narrower container on mobile */}
      <div className="w-full max-w-[100vw] overflow-x-hidden">
        <div className="px-3 py-3 md:container md:mx-auto md:px-4 md:py-6">
          <div className="md:grid md:grid-cols-12 md:gap-6">
            {/* Sidebar for invitations */}
            <div className="md:col-span-4 lg:col-span-3 space-y-4 mb-4 md:mb-0">
              {pendingInvitations.length > 0 && (
                <PendingInvitationsList
                  invitations={pendingInvitations}
                  onReject={handleRejectInvitation}
                />
              )}
              
              {activeInvitations.length > 0 && (
                <ActiveInvitationsList invitations={activeInvitations} />
              )}
            </div>
            
            {/* Main content */}
            <div className="md:col-span-8 lg:col-span-9">
              <MatchFinderWizard
                onMatchFound={handleMatchFound}
                preSelectedTopicId={preSelectedTopicId}
                selectedTopic={selectedTopic}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
