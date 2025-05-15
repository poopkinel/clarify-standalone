import React, { useState, useEffect } from 'react';

export default function Avatar({ user, className = "", size = "md" }) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  
  const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
    xl: "w-14 h-14 text-xl",
    "2xl": "w-16 h-16 text-2xl"
  };

  const sizeClass = sizes[size] || sizes.md;

  // Find the correct image URL when component mounts or user changes
  useEffect(() => {
    if (!user) return;
    
    // Check all possible avatar image fields
    const possibleUrls = [
      user.avatar_image,
      user.avatarImage,
      user.profile?.avatar_image,
      user.image
    ];
    
    // Find the first valid URL
    const validUrl = possibleUrls.find(url => 
      url && typeof url === 'string' && (
        url.startsWith('http') || 
        url.startsWith('data:') ||
        url.startsWith('/')
      )
    );
    
    if (validUrl) {
      setImageUrl(validUrl);
      setImageError(false);
    } else {
      setImageUrl(null);
    }
  }, [user]);

  if (!user) {
    return null;
  }

  // Get initial letter from display name or full name
  const getInitial = () => {
    const name = user.display_name || user.full_name;
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // Show avatar image if we have a valid URL and no loading error
  if (imageUrl && !imageError) {
    return (
      <div 
        className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white relative ${className}`}
      >
        <img 
          src={imageUrl} 
          alt={`${user.display_name || 'User'}'s avatar`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Fallback to color-based avatar with initial
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-white ${className}`}
      style={{ backgroundColor: user.avatar_color || "#6366f1" }}
    >
      {getInitial()}
    </div>
  );
}