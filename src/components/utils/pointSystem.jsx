// Create a new utility file for point awarding

import { UserProfile } from "@/api/entities";

export async function awardPointsToUser(userId, points, category = null) {
  try {
    // First check if user profile exists
    const userProfiles = await UserProfile.filter({ user_id: userId });
    
    if (userProfiles.length === 0) {
      console.log(`Cannot award points: No profile found for user ${userId}`);
      
      // Create a basic profile with these initial points
      const newProfile = await UserProfile.create({
        user_id: userId,
        display_name: "User",  // Default name
        level: 1,
        total_points: points,
        conversations_completed: category === 'conversation_complete' ? 1 : 0,
        badges: ["newcomer"],
        highest_scores: {
          empathy: 0,
          clarity: 0,
          open_mindedness: 0
        }
      });
      
      console.log(`Created new profile and awarded ${points} points`, newProfile);
      return newProfile;
    }
    
    // Profile exists, update it
    const profile = userProfiles[0];
    const newTotalPoints = (profile.total_points || 0) + points;
    
    // Calculate level from points (1 level per 100 points)
    const newLevel = Math.floor(newTotalPoints / 100) + 1;
    
    // Update profile with new points and possibly level
    const updates = {
      total_points: newTotalPoints
    };
    
    // Only update level if it changed
    if (newLevel > (profile.level || 1)) {
      updates.level = newLevel;
    }
    
    // If this is for completing a conversation, increment that counter
    if (category === 'conversation_complete') {
      updates.conversations_completed = (profile.conversations_completed || 0) + 1;
    }
    
    const updatedProfile = await UserProfile.update(profile.id, updates);
    return updatedProfile;
  } catch (error) {
    console.error("Error awarding points:", error);
    throw new Error(`Failed to award points: ${error.message}`);
  }
}