import Layout from "./Layout.jsx";

import Onboarding from "./Onboarding";

import Topics from "./Topics";

import Conversations from "./Conversations";

import Achievements from "./Achievements";

import Profile from "./Profile";

import ChatView from "./ChatView";

import FindPartners from "./FindPartners";

import AdminTopics from "./AdminTopics";

import TopConversations from "./TopConversations";

import Dashboard from "./Dashboard";

import Landing from "./Landing";

import Community from "./Community";

import UserProfile from "./UserProfile";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Onboarding: Onboarding,
    
    Topics: Topics,
    
    Conversations: Conversations,
    
    Achievements: Achievements,
    
    Profile: Profile,
    
    ChatView: ChatView,
    
    FindPartners: FindPartners,
    
    AdminTopics: AdminTopics,
    
    TopConversations: TopConversations,
    
    Dashboard: Dashboard,
    
    Landing: Landing,
    
    Community: Community,
    
    UserProfile: UserProfile,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Onboarding />} />
                
                
                <Route path="/Onboarding" element={<Onboarding />} />
                
                <Route path="/Topics" element={<Topics />} />
                
                <Route path="/Conversations" element={<Conversations />} />
                
                <Route path="/Achievements" element={<Achievements />} />
                
                <Route path="/Profile" element={<Profile />} />
                
                <Route path="/ChatView" element={<ChatView />} />
                
                <Route path="/FindPartners" element={<FindPartners />} />
                
                <Route path="/AdminTopics" element={<AdminTopics />} />
                
                <Route path="/TopConversations" element={<TopConversations />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Landing" element={<Landing />} />
                
                <Route path="/Community" element={<Community />} />
                
                <Route path="/UserProfile" element={<UserProfile />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}