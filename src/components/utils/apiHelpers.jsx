
// Helper functions for API calls and rate limiting
import { useState, useEffect } from 'react';
import { UserProfile } from "@/api/entities";
import { User } from "@/api/entities";

// Import the new backend function
import { sendExternalPushNotification } from '@/api/functions';

// Delay function for rate limiting
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Global API call tracker to prevent rate limiting
if (typeof window !== 'undefined' && !window.apiCallsTracker) {
  window.apiCallsTracker = {
    calls: 0,
    resetTime: Date.now() + 60000,
    queue: []
  };
}

// API request queue manager
export const enqueueApiRequest = async (requestFn) => {
  if (typeof window === 'undefined') {
    return requestFn();
  }
  
  // Ensure tracker exists
  if (!window.apiCallsTracker) {
    window.apiCallsTracker = {
      calls: 0,
      resetTime: Date.now() + 60000,
      queue: []
    };
  }
  
  // Create a promise that will resolve when the request completes
  return new Promise((resolve, reject) => {
    const request = { fn: requestFn, resolve, reject };
    
    // Add to queue
    window.apiCallsTracker.queue.push(request);
    
    // Start processing the queue if it's not already running
    if (window.apiCallsTracker.queue.length === 1) {
      processQueue();
    }
  });
};

// Process API request queue
const processQueue = async () => {
  if (!window.apiCallsTracker.queue.length) {
    return;
  }
  
  const now = Date.now();
  
  // Reset counters if time has passed
  if (now > window.apiCallsTracker.resetTime) {
    window.apiCallsTracker.calls = 0;
    window.apiCallsTracker.resetTime = now + 60000;
  }
  
  // Check if we're at the rate limit
  if (window.apiCallsTracker.calls >= 10) {
    // Wait until the reset time
    const waitTime = window.apiCallsTracker.resetTime - now + 100; // add 100ms buffer
    console.log(`Rate limit reached, waiting ${waitTime}ms before next request`);
    await delay(waitTime);
    
    // Reset after waiting
    window.apiCallsTracker.calls = 0;
    window.apiCallsTracker.resetTime = Date.now() + 60000;
  }
  
  // Process the next request
  const request = window.apiCallsTracker.queue[0];
  
  try {
    // Increment call counter
    window.apiCallsTracker.calls++;
    
    // Execute the request
    const result = await request.fn();
    request.resolve(result);
  } catch (error) {
    // If it's a rate limit error, wait and retry
    if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
      console.log('Rate limit hit, adding delay before next request');
      // Add a longer delay for rate limit errors
      await delay(3000);
      
      // Reset counters
      window.apiCallsTracker.calls = 0;
      window.apiCallsTracker.resetTime = Date.now() + 60000;
      
      // Try again with this request - put it back at the front of the queue
      processQueue();
      return;
    } else {
      request.reject(error);
    }
  }
  
  // Remove the processed request from queue
  window.apiCallsTracker.queue.shift();
  
  // Add a small delay between requests
  await delay(300);
  
  // Continue processing the queue
  if (window.apiCallsTracker.queue.length) {
    processQueue();
  }
};

// Retry function with exponential backoff
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 3000) {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      
      // If we've hit max retries or it's not a rate limit error, throw
      if (retries > maxRetries || (error.message && !error.message.includes('Rate limit') && !error.message.includes('429'))) {
        throw error;
      }
      
      const delayTime = initialDelay * Math.pow(2, retries - 1);
      console.log(`Rate limit hit, retrying in ${delayTime}ms...`);
      await delay(delayTime);
    }
  }
}

// Enhanced cache mechanism with longer TTL and smarter refresh
const cache = {
  data: {},
  timestamps: {},
  ttl: 600000, // 10 minute default TTL (increased)
};

export function useCache(key, fetchFn, options = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { 
    ttl = cache.ttl,
    forceRefresh = false,
    onSuccess = () => {},
    onError = () => {},
  } = options;
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Check cache first unless forceRefresh is true
        const now = Date.now();
        const cacheEntry = cache.data[key];
        const cacheTime = cache.timestamps[key] || 0;
        
        if (!forceRefresh && cacheEntry && (now - cacheTime) < ttl) {
          setData(cacheEntry);
          onSuccess(cacheEntry);
          setIsLoading(false);
          return;
        }
        
        // Add tracking for API calls to prevent too many requests
        if (typeof window !== 'undefined') {
          // Ensure apiCallsTracker exists
          if (!window.apiCallsTracker) {
            window.apiCallsTracker = {
              calls: 0,
              resetTime: now + 60000,
              queue: []
            };
          }
          
          // Reset if needed
          if (now > window.apiCallsTracker.resetTime) {
            window.apiCallsTracker.calls = 0;
            window.apiCallsTracker.resetTime = now + 60000;
          }
          
          window.apiCallsTracker.calls++;
          
          // If we're making too many calls, use cache even if expired or delay
          if (window.apiCallsTracker.calls > 20) {
            console.log("Too many API calls in last minute, using cache or delaying");
            
            if (cacheEntry) {
              setData(cacheEntry);
              onSuccess(cacheEntry);
              setIsLoading(false);
              return;
            }
            
            // If no cache, delay the request
            await delay(5000);
          }
        }
        
        // Fetch with retry - reduced retries and increased initial delay
        const result = await retryWithBackoff(() => fetchFn(), 2, 5000);
        
        // Update cache
        cache.data[key] = result;
        cache.timestamps[key] = now;
        
        setData(result);
        onSuccess(result);
      } catch (err) {
        console.error(`Error fetching data for key ${key}:`, err);
        setError(err);
        onError(err);
        
        // On error, try to use expired cache data as fallback
        const cacheEntry = cache.data[key];
        if (cacheEntry) {
          console.log(`Using expired cache as fallback for key ${key}`);
          setData(cacheEntry);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [key, forceRefresh]);
  
  return { data, isLoading, error, setData };
}

// Enhanced entity cache with better handling of rate limits
export const entityCache = {
  data: {},
  set: (entityName, id, data) => {
    if (!entityCache.data[entityName]) {
      entityCache.data[entityName] = {};
    }
    entityCache.data[entityName][id] = {
      data,
      timestamp: Date.now()
    };
  },
  get: (entityName, id, maxAge = 600000) => { // Increased to 10 minutes
    if (!entityCache.data[entityName] || !entityCache.data[entityName][id]) {
      return null;
    }
    
    const entry = entityCache.data[entityName][id];
    if (Date.now() - entry.timestamp > maxAge) {
      return null;
    }
    
    return entry.data;
  },
  clear: () => {
    entityCache.data = {};
  }
};

// Utility to batch API calls to avoid rate limits
export const batchApiCalls = async (items, callFn, batchSize = 3, delayMs = 1000) => {
  const results = [];
  
  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(item => callFn(item));
    
    // Process each batch
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Add successful results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Error in batch API call:`, result.reason);
      }
    });
    
    // Add delay between batches, but only if there are more items
    if (i + batchSize < items.length) {
      await delay(delayMs);
    }
  }
  
  return results;
};

export async function sendPushNotification(payload) {
  try {
    // Now, instead of fetch-ing the external server directly,
    // we call our backend function.
    // The base44 platform handles authentication between frontend and backend function.
    const { data, error, status } = await sendExternalPushNotification(payload);

    if (error) {
      console.error('Failed to send push notification via backend function:', status, data?.details || data?.error || error.message);
    } else if (status >= 200 && status < 300) {
      console.log('Push notification request sent successfully via backend function. User:', payload.userId, 'Type:', payload.type);
    } else {
      console.warn('Push notification request to backend function returned status:', status, data);
    }
    
    // If this notification is for the current user and browser supports notifications,
    // and permission is granted, show a local browser notification as well.
    // This part remains for immediate feedback in the active browser tab.
    const currentUserId = await getCurrentUserId();
    
    if (currentUserId === payload.userId && 
        typeof window !== 'undefined' && 
        'Notification' in window && 
        Notification.permission === 'granted') {
      
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: "https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png", // Make sure this icon is accessible
        data: payload.data // This data can be used in notification.onclick
      });
      
      notification.onclick = function() {
        window.focus(); // Focus the current window
        // Example: navigate to a specific chat if conversationId is in payload.data
        if (payload.data && payload.data.conversationId) {
          // Make sure createPageUrl is available or construct the URL directly
          // For simplicity, assuming direct URL construction for now.
          // Ideally, use a navigation utility if this helper is used outside React components
          // that have access to react-router's navigate.
          window.location.href = `/ChatView?id=${payload.data.conversationId}`;
        }
      };
    }

  } catch (err) {
    // This catch is for errors in the frontend part of sendPushNotification
    // or if the call to the backend function itself fails network-wise.
    console.error('Error in frontend sendPushNotification function:', err);
  }
}

// Helper to get current user ID (can be simplified or enhanced)
async function getCurrentUserId() {
  try {
    // Try to get from localStorage first for performance
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed && parsed.id) {
        return parsed.id;
      }
    }
    
    // If not available in localStorage, fetch from API
    const user = await User.me();
    return user ? user.id : null;
  } catch (error) {
    // console.error('Error getting current user ID:', error);
    return null; // Return null if not authenticated or error
  }
}


// Function to request browser notification permissions
// This is good to have if you want to prompt the user explicitly
export async function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Browser notification permission granted.');
          // Optionally, send a test notification or inform your backend
        } else if (permission === 'denied') {
          console.warn('Browser notification permission denied.');
        } else {
          console.log('Browser notification permission not granted (dismissed).');
        }
      } catch (error) {
        console.error('Error requesting browser notification permission:', error);
      }
    } else if (Notification.permission === 'granted') {
      console.log('Browser notification permission already granted.');
    } else {
      console.warn('Browser notification permission already denied.');
    }
  } else {
    console.warn('Browser notifications not supported.');
  }
}
