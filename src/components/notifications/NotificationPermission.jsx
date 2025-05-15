
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Info } from 'lucide-react';
import { useAppToast } from '@/components/utils/toast';
import { useLanguage } from '@/components/utils/i18n';
import { User } from '@/api/entities';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const { showToast } = useAppToast();
  const { t } = useLanguage();

  // Function to detect incognito mode
  useEffect(() => {
    // Attempt to detect incognito mode
    const checkIncognito = async () => {
      try {
        // Method: Check if indexed DB is available (often restricted in incognito)
        const db = indexedDB.open('test');
        db.onerror = () => {
          console.log('Possible incognito mode detected');
          setIsIncognito(true);
        };
      } catch (e) {
        console.log('Error in incognito detection:', e);
      }
    };
    
    checkIncognito();
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }
    
    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    console.log('Current notification permission state:', currentPermission);

    // Show prompt only if permission is 'default' and not already shown recently
    const lastPromptTime = localStorage.getItem('notificationPromptLastShown');
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (currentPermission === 'default' && (!lastPromptTime || (Date.now() - parseInt(lastPromptTime)) > oneDay)) {
      // Delay showing the prompt slightly to avoid being too intrusive
      const timer = setTimeout(() => {
        setShowPrompt(true);
        localStorage.setItem('notificationPromptLastShown', Date.now().toString());
      }, 10000); // Show after 10 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      showToast(t('Notifications not supported'), t('Your browser does not support notifications.'), 'destructive');
      return;
    }

    try {
      console.log('Requesting notification permission...');
      const permissionResult = await Notification.requestPermission();
      console.log('Permission request result:', permissionResult);
      setPermission(permissionResult);
      setShowPrompt(false); // Hide prompt after interaction

      if (permissionResult === 'granted') {
        showToast(t('Notifications Enabled!'), t('You will now receive updates.'), 'default');
        
        // Send a test notification
        setTimeout(() => {
          try {
            const testNotification = new Notification('Notifications Enabled!', {
              body: 'You will now receive notifications for new messages and invitations.',
              icon: 'https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png'
            });
          } catch (e) {
            console.error('Error showing test notification:', e);
          }
          
          // We removed the registerWithServer() call from here.
          // The actual push subscription registration happens in PushNotificationManager.jsx
        }, 1000);
      } else if (permissionResult === 'denied') {
        if (isIncognito) {
          showToast(
            t('Incognito Mode Detected'), 
            t('Notifications are blocked in private/incognito windows. Please try in a normal browser window.'), 
            'destructive'
          );
        } else {
          showToast(t('Notifications Denied'), t('You can enable them later in browser settings.'), 'default');
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      showToast(t('Permission Error'), t('Could not request notification permission.'), 'destructive');
    }
  };

  const handleLater = () => {
    setShowPrompt(false);
    localStorage.setItem('notificationPromptLastShown', Date.now().toString());
  };

  if (permission === 'granted' || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white p-6 rounded-lg shadow-xl border border-gray-200 z-[10000] max-w-sm w-full">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {permission === 'denied' ? (
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          ) : (
            <Bell className="h-6 w-6 text-indigo-600" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {permission === 'denied' ? t('Notifications Blocked') : t('Enable notifications?')}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {permission === 'denied' 
              ? t('Please enable notifications in your browser settings to receive updates.') 
              : t('Get notified about new messages, invitations, and activity in your discussions.')}
          </p>
          <div className="flex justify-end space-x-2">
            {permission !== 'denied' && (
              <>
                <Button variant="outline" onClick={handleLater}>
                  {t('Later')}
                </Button>
                <Button onClick={requestPermission}>
                  {t('Enable')}
                </Button>
              </>
            )}
            {permission === 'denied' && (
              <Button onClick={() => setShowPrompt(false)}>
                {t('OK')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
