import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "6811057718732483e7ca1be5", 
  requiresAuth: true // Ensure authentication is required for all operations
});
