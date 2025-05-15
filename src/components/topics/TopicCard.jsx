
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, ThumbsUp, MessageCircle, Activity, Flame, Users, Pencil, Mail, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useLanguage } from '@/components/utils/i18n';

const getTagColor = (tag) => {
  // Color mapping for common tags (previously categories)
  const colors = {
    politics: "bg-blue-600 text-white",
    ethics: "bg-purple-600 text-white",
    technology: "bg-emerald-600 text-white",
    environment: "bg-green-600 text-white",
    education: "bg-amber-600 text-white",
    healthcare: "bg-red-600 text-white",
    economics: "bg-indigo-600 text-white"
  };
  return colors[tag] || "bg-gray-600 text-white";
};

// Update the getPlaceholderImage function to handle RTL languages properly
const getPlaceholderImage = (topic) => {
  if (topic.image_url) return topic.image_url;
  
  // Default tag-based images
  const tagImages = {
    politics: "https://images.unsplash.com/photo-1575320181282-9afab399332c?q=80&w=800",
    ethics: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800",
    technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800",
    environment: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800",
    education: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800",
    healthcare: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=800",
    economics: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800",
    // Add language-specific images
    'lang:he': "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800",
    'lang:ar': "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800",
    'he': "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800",
    'ar': "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800"
  };
  
  // First check if topic has a language property
  if (topic.language && tagImages[`lang:${topic.language}`]) {
    return tagImages[`lang:${topic.language}`];
  }
  
  // Then check for language tags
  if (topic.tags && topic.tags.length > 0) {
    // Check for language tags first
    const languageTags = topic.tags.filter(tag => 
      tag.startsWith('lang:') || 
      tag === 'he' || 
      tag === 'ar' || 
      tag === 'en'
    );
    
    if (languageTags.length > 0 && tagImages[languageTags[0]]) {
      return tagImages[languageTags[0]];
    }
    
    // Then fall back to regular tags
    for (const tag of topic.tags) {
      if (tagImages[tag]) {
        return tagImages[tag];
      }
    }
  }
  
  // Create a search query based on topic details
  const searchQuery = encodeURIComponent(
    `${topic.title} ${topic.tags && topic.tags[0] || ""}`
  ).substring(0, 100);
  
  // Use Unsplash Source API with the search query
  return `https://source.unsplash.com/800x600/?${searchQuery}`;
};

const getTopicTitle = (topic) => {
  return topic.title;
};

// Helper function to construct a page URL 
const createPageUrl = (pageName) => {
  // This must match your actual createPageUrl utility function
  return `/${pageName}`;
};

// Update the TopicCard component to handle detailed views and stat clicks
const TopicCard = React.memo(({ 
  topic, 
  userOpinion, 
  onSelect, 
  topicStats, 
  rank, 
  activeConversation,
  activeConversationsWithNewMessages = [],
  pendingInvitation,
  pendingInvitationsCount = 0,
  acceptedInvitations = [],
  onFindPartners,
  onViewInvitations,
  onViewNewMessages,
  onViewAcceptedInvitation,
  onViewStats
}) => {
  const { t } = useLanguage();
  const [showAllTags, setShowAllTags] = useState(false);

  // Add more detailed logging
  console.log("[TopicCard] Rendering for topic:", topic.id, {
    pendingInvitation: pendingInvitation ? "yes" : "no",
    pendingCount: pendingInvitationsCount,
    hasActiveConv: activeConversation ? "yes" : "no",
    hasUserOpinion: userOpinion ? "yes" : "no"
  });

  const hasOpinion = !!userOpinion;
  const stats = topicStats || { 
    totalDiscussions: 0, 
    totalOpinions: 0, 
    activeDiscussions: 0,
    recentActivity: false
  };
  
  // Check if stats values are placeholders ('...')
  const isLoadingStats = 
    stats.totalDiscussions === '...' || 
    stats.totalOpinions === '...' || 
    stats.activeDiscussions === '...';
  
  // Check if this is a recently created topic (last 10 minutes)
  const isNewTopic = topic.created_date && 
    (Date.now() - new Date(topic.created_date).getTime() < 10 * 60 * 1000);
  
  // Calculate active discussions - only count actual active conversations
  const activeDiscussions = stats.activeDiscussions || 0;

  // Get a relevant image for the topic
  const imageUrl = getPlaceholderImage(topic);

  // Show "hot" indicator based on real activity only
  const isHot = !isNewTopic && ((stats.totalOpinions || 0) > 5);
  
  // Calculate total new messages across all conversations for this topic
  const newMessagesCount = activeConversationsWithNewMessages.reduce(
    (total, conv) => total + (conv.newMessagesCount || 0), 
    0
  );
  
  const handleTagExpand = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowAllTags(true);
  };

  const handleTagCollapse = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowAllTags(false);
  };

  // Handle topic card click to display detailed view
  const handleCardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onSelect === 'function') {
      console.log("[TopicCard] Card clicked:", topic.id);
      // Pass full topic object for detail view
      onSelect(topic, 'detail');
    }
  };
  
  // New handler specifically for stat clicks
  const handleStatClick = (e, statType) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof onViewStats === 'function') {
      console.log("[TopicCard] Stat clicked:", statType);
      onViewStats(topic, statType);
    }
  };
  
  const handleButtonClick = (e) => {
    e.stopPropagation();
    
    const action = e.currentTarget.getAttribute('data-action');
    
    if (action === 'findPartners' && typeof onFindPartners === 'function') {
      console.log("[TopicCard] Find Partners clicked for topic:", topic.id);
      onFindPartners(topic);
    } else if (action === 'continueDiscussion' && activeConversation) {
      // Use the imported createPageUrl for consistency
      window.location.href = `${createPageUrl("Conversations")}?topicId=${topic.id}`;
    } else if (action === 'viewInvitations' && typeof onViewInvitations === 'function') {
        console.log("[TopicCard] View Invitations clicked for topic:", topic.id);
        onViewInvitations(topic);
    } else if (action === 'editOpinion') {
      // Handle opinion editing - pass topic to parent component
      if (typeof onSelect === 'function') {
        console.log("[TopicCard] Edit Opinion clicked:", topic.id);
        onSelect(topic, 'opinion');
      }
    } else {
      // Default action: select the topic to view/edit opinion
      if (typeof onSelect === 'function') {
        console.log("[TopicCard] Button clicked:", topic.id);
        onSelect(topic, 'opinion');
      }
    }
  };

  const getActionButton = () => {
    if (activeConversation) {
      return (
        <Button 
          onClick={handleButtonClick}
          className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
          data-topic-id={topic.id}
          data-action="continueDiscussion"
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{t('continue_discussion')}</span>
        </Button>
      );
    }

    // Check if there are multiple pending invitations
    if (pendingInvitationsCount > 1) {
      return (
        <Button 
          onClick={handleButtonClick}
          className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
          data-topic-id={topic.id}
          data-action="viewInvitations"
          type="button"
        >
          <Users className="h-4 w-4" />
          <span>{t('choose_partner')} ({pendingInvitationsCount})</span>
        </Button>
      );
    }

    // Single pending invitation
    if (pendingInvitation) {
      return (
        <Button 
          onClick={handleButtonClick}
          className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
          data-topic-id={topic.id}
          data-action="viewInvitations"
          type="button"
        >
          <Users className="h-4 w-4" />
          <span>{t('join_discussion')}</span>
        </Button>
      );
    }

    if (hasOpinion) {
      return (
        <div className="flex gap-2">
          <Button 
            onClick={handleButtonClick}
            variant="outline"
            className="flex-1 flex items-center justify-center gap-2"
            data-topic-id={topic.id}
            data-action="findPartners"
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t('find_discussion_partners')}</span>
          </Button>
          <Button
            onClick={handleButtonClick}
            variant="ghost"
            className="text-gray-600 hover:text-gray-800"
            size="icon"
            data-action="editOpinion"
            title={t('update_opinion')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <Button 
        onClick={handleButtonClick}
        className="w-full bg-indigo-600 hover:bg-indigo-700"
        data-topic-id={topic.id}
        type="button"
      >
        {t('share_your_opinion')}
      </Button>
    );
  };

  return (
    <Card 
      className="overflow-hidden bg-white hover:shadow-lg transition-shadow duration-200 cursor-pointer mx-0"
      onClick={handleCardClick}
      data-topic-id={topic.id}
      role="button"
      aria-label={`Select topic: ${topic.title}`}
    >
      <div className="relative h-40">
        {/* Background image with gradient overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
        
        {/* Tags - Update to handle expanding/collapsing tags */}
        <div className="absolute top-3 left-3 right-20 flex flex-wrap gap-1 max-w-[75%]">
          {/* Display visible tags */}
          {topic.tags && (showAllTags ? topic.tags : topic.tags.slice(0, 3)).map((tag, index) => (
            <Badge 
              key={tag} 
              className={index === 0 ? getTagColor(tag) : "bg-white/80 text-gray-800"}
            >
              {tag}
            </Badge>
          ))}
          
          {/* Show count of additional tags with click handler */}
          {!showAllTags && topic.tags && topic.tags.length > 3 && (
            <Badge 
              variant="outline" 
              className="bg-white/80 text-gray-800 text-xs cursor-pointer hover:bg-gray-100"
              onClick={handleTagExpand}
            >
              +{topic.tags.length - 3}
            </Badge>
          )}
          
          {/* Show collapse button when all tags are shown */}
          {showAllTags && topic.tags && topic.tags.length > 3 && (
            <Badge 
              variant="outline" 
              className="bg-white/80 text-gray-800 text-xs cursor-pointer hover:bg-gray-100"
              onClick={handleTagCollapse}
            >
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        
        {/* Activity badges - Updated with shorter text */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {/* Accepted invitation indicator - shortened text */}
          {acceptedInvitations.length > 0 && (
            <Badge 
              variant="outline" 
              className="bg-green-500 text-white border-green-300 flex items-center gap-1 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onViewAcceptedInvitation === 'function') {
                  onViewAcceptedInvitation(topic, acceptedInvitations[0]);
                }
              }}
            >
              <Users className="h-3 w-3" />
              <span>{t('accepted')}</span>
            </Badge>
          )}

          {/* New messages indicator - Made shorter when in RTL languages */}
          {activeConversationsWithNewMessages.length > 0 && (
            <Badge 
              variant="outline" 
              className="bg-red-500 text-white border-red-300 flex items-center gap-1 cursor-pointer text-xs whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onViewNewMessages === 'function') {
                  onViewNewMessages(topic, activeConversationsWithNewMessages);
                }
              }}
              data-action="viewNewMessages"
            >
              <Mail className="h-3 w-3" />
              <span>
                {activeConversationsWithNewMessages.length > 1 
                  ? `${newMessagesCount} ${t('new')}` 
                  : `${newMessagesCount} ${t('new')}`
                }
              </span>
            </Badge>
          )}

          {/* Pending invitations indicator - Made more compact */}
          {pendingInvitationsCount > 0 && (
            <Badge 
              variant="outline" 
              className="bg-purple-500 text-white border-purple-300 flex items-center gap-1 cursor-pointer text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onViewInvitations === 'function') {
                  onViewInvitations(topic);
                }
              }}
              data-action="viewInvitations"
            >
              <Users className="h-3 w-3" />
              <span>
                {pendingInvitationsCount > 1 
                  ? `${pendingInvitationsCount}` 
                  : `1`
                }
              </span>
            </Badge>
          )}
          
          {/* Hot topic indicator */}
          {isHot && (
            <Badge className="bg-orange-500 text-white flex items-center gap-1 text-xs whitespace-nowrap">
              <Flame className="h-3 w-3" />
              <span>{t('hot')}</span>
            </Badge>
          )}
          
          {/* Rank badge if provided */}
          {rank && (
            <Badge variant="secondary" className="bg-white/90 text-gray-900 font-semibold text-xs">
              #{rank}
            </Badge>
          )}
        </div>
        
        {/* Title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-lg font-semibold text-white line-clamp-2">
            {topic.title}
          </h3>
        </div>
      </div>

      <CardContent className="p-4">
        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
          {topic.description}
        </p>

        {/* Clickable Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div 
            className="flex flex-col items-center justify-center p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
            onClick={(e) => handleStatClick(e, 'totalConversations')}
            role="button"
            aria-label={t('View all conversations')}
          >
            <div className="flex items-center gap-1.5 justify-center mb-1">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-medium">{t('total')}</span>
            </div>
            {isLoadingStats ? (
              <div className="h-5 w-8 animate-pulse bg-gray-200 rounded"></div>
            ) : (
              <span className="font-semibold">{stats.totalDiscussions || 0}</span>
            )}
          </div>
          
          <div 
            className="flex flex-col items-center justify-center p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
            onClick={(e) => handleStatClick(e, 'activeConversations')}
            role="button"
            aria-label={t('View active conversations')}
          >
            <div className="flex items-center gap-1.5 justify-center mb-1">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium">{t('active')}</span>
            </div>
            {isLoadingStats ? (
              <div className="h-5 w-8 animate-pulse bg-gray-200 rounded"></div>
            ) : (
              <span className="font-semibold">{activeDiscussions}</span>
            )}
          </div>
          
          <div 
            className="flex flex-col items-center justify-center p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
            onClick={(e) => handleStatClick(e, 'opinions')}
            role="button" 
            aria-label={t('View all opinions')}
          >
            <div className="flex items-center gap-1.5 justify-center mb-1">
              <ThumbsUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium">{t('opinions')}</span>
            </div>
            {isLoadingStats ? (
              <div className="h-5 w-8 animate-pulse bg-gray-200 rounded"></div>
            ) : (
              <span className="font-semibold">{stats.totalOpinions || 0}</span>
            )}
          </div>
        </div>

        {getActionButton()}
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.topic.id === nextProps.topic.id &&
    prevProps.userOpinion?.id === nextProps.userOpinion?.id &&
    JSON.stringify(prevProps.topicStats) === JSON.stringify(nextProps.topicStats) &&
    prevProps.activeConversation === nextProps.activeConversation &&
    prevProps.pendingInvitation === nextProps.pendingInvitation &&
    prevProps.pendingInvitationsCount === nextProps.pendingInvitationsCount &&
    JSON.stringify(prevProps.activeConversationsWithNewMessages) === 
    JSON.stringify(nextProps.activeConversationsWithNewMessages) &&
    JSON.stringify(prevProps.acceptedInvitations) === JSON.stringify(nextProps.acceptedInvitations)
  );
});

TopicCard.displayName = 'TopicCard';
export default TopicCard;
