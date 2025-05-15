
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { User } from '@/api/entities';
import { MessageCircle } from 'lucide-react'; // Assuming you have lucide-react installed
// You might need to install it: npm install lucide-react

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await User.me();
        if (user) {
          // Redirect to Dashboard instead of Topics
          navigate(createPageUrl("Dashboard"));
        }
      } catch (error) {
        // User is not authenticated, stay on Landing
        console.log("User not authenticated, staying on Landing page");
      }
    };
    
    checkAuth();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="flex items-center gap-2">
        <img 
          src="https://raw.githubusercontent.com/poopkinel/clarify/82c2c73c1130cf050e827c8f0d3477a7aca2d904/ClarifyLogoDesign.png" 
          alt="Clarify Logo" 
          className="w-10 h-10"
        />
        <span className="font-bold text-xl text-gray-800">Clarify</span>
      </div>
      <p className="text-gray-600 mt-4">Welcome to Clarify!</p>
    </div>
  );
}
