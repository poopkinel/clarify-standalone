import React, { useState, useEffect, useRef } from "react";
import { User } from "@/api/entities";
import { Conversation } from "@/api/entities";
import { Message } from "@/api/entities";
import { useAppToast } from "@/components/utils/toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PushNotificationManager() {
  const { showToast } = useAppToast();
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const pollingIntervalRef = useRef(null);
  const navigate = useNavigate();
  const seenNotificationsRef = useRef(new Set());

  // Function to check for new invitations and messages
  const checkForNotifications = async () => {
    try {
      let user;
      try {
        user = await User.me();
        if (!user?.id) {
          console.log('[NotificationManager] User not authenticated');
          return;
        }
      } catch (error) {
        console.error('[NotificationManager] Error getting user:', error);
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastCheckTime < 30000) { // Don't check more than once every 30 seconds
        return;
      }
      
      setLastCheckTime(currentTime);
      
      // Check for new conversation invitations
      try {
        const invitations = await Conversation.filter({
          participant2_id: user.id,
          status: "invited"
        }, "-created_date");
        
        if (invitations && invitations.length > 0) {
          // Only notify about invitations we haven't seen before
          const newInvitations = invitations.filter(inv => !seenNotificationsRef.current.has(`inv_${inv.id}`));
          
          if (newInvitations.length > 0) {
            console.log('[NotificationManager] New invitations:', newInvitations);
            
            // Mark these invitations as seen
            newInvitations.forEach(inv => {
              seenNotificationsRef.current.add(`inv_${inv.id}`);
            });
            
            // Show notification for the latest invitation
            const latestInvitation = newInvitations[0];
            showNotification(
              "New Conversation Invitation",
              "You have a new invitation to discuss a topic",
              () => navigate(createPageUrl("FindPartners"))
            );
          }
        }
      } catch (error) {
        console.error('[NotificationManager] Error checking invitations:', error);
      }
      
      // Check for unread messages in active conversations
      try {
        const activeConversations = await Conversation.filter({
          $or: [
            { participant1_id: user.id, status: "active" },
            { participant2_id: user.id, status: "active" }
          ]
        });
        
        if (activeConversations && activeConversations.length > 0) {
          for (const conversation of activeConversations) {
            // Get unread messages sent to current user
            const otherParticipantId = conversation.participant1_id === user.id 
              ? conversation.participant2_id 
              : conversation.participant1_id;
              
            const messages = await Message.filter({
              conversation_id: conversation.id,
              sender_id: otherParticipantId,
              read: false
            }, "-sent_at");
            
            if (messages && messages.length > 0) {
              // Only notify about messages we haven't notified about
              const newMessages = messages.filter(msg => !seenNotificationsRef.current.has(`msg_${msg.id}`));
              
              if (newMessages.length > 0) {
                console.log('[NotificationManager] New messages in conversation:', conversation.id, newMessages);
                
                // Mark these messages as seen in our notification system
                newMessages.forEach(msg => {
                  seenNotificationsRef.current.add(`msg_${msg.id}`);
                });
                
                // Show notification for the latest message
                showNotification(
                  "New Message",
                  "You have a new message in your conversation",
                  () => navigate(`${createPageUrl("ChatView")}?id=${conversation.id}`)
                );
                
                // Only show one notification at a time
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error('[NotificationManager] Error checking messages:', error);
      }
    } catch (error) {
      console.error('[NotificationManager] Error during notification check:', error);
    }
  };
  
  // Function to show a browser notification
  const showNotification = (title, body, onClick) => {
    // Check if notifications are supported and permission is granted
    if (!('Notification' in window)) {
      console.log('[NotificationManager] Browser does not support notifications');
      return;
    }
    
    if (Notification.permission !== 'granted') {
      console.log('[NotificationManager] Notification permission not granted');
      return;
    }
    
    try {
      // Create and show notification
      const notification = new Notification(title, {
        body: body,
        icon: 'https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png'
      });
      
      // Handle click event
      if (onClick) {
        notification.onclick = () => {
          notification.close();
          window.focus();
          onClick();
        };
      }
      
      // Also show a toast inside the app
      showToast(title, body);
    } catch (error) {
      console.error('[NotificationManager] Error showing notification:', error);
    }
  };

  // Setup polling interval
  useEffect(() => {
    // Initial check
    checkForNotifications();
    
    // Set up regular polling
    pollingIntervalRef.current = setInterval(checkForNotifications, 60000); // Check every minute
    
    // Add visibility change listener to check immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForNotifications();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}