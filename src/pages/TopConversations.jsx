import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TopConversationsList from "../components/conversations/TopConversationsList";
import { Trophy, ArrowRight, ThumbsUp, Users, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/utils/i18n';

export default function TopConversations() {
  const navigate = useNavigate();
  const { t, direction } = useLanguage();
  
  return (
    <div className="space-y-8">
      {/* Enhanced header */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 md:p-8 rounded-xl shadow-sm">
        <div className="max-w-3xl">
          <div className={`flex items-center gap-3 mb-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Trophy className="h-7 w-7 text-amber-500" />
            <h1 className="text-3xl font-bold text-gray-900">{t("Top Conversations")}</h1>
          </div>
          <p className={`text-gray-600 text-lg mb-4 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
            {t("Explore exemplary discussions that demonstrate thoughtful engagement and constructive dialogue")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className={`bg-white/80 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <Sparkles className="h-6 w-6 text-yellow-500" />
              <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                <div className="text-sm text-gray-600">{t("Highest scores")}</div>
                <div className="font-semibold">{t("Quality content")}</div>
              </div>
            </div>
            <div className={`bg-white/80 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <MessageCircle className="h-6 w-6 text-blue-500" />
              <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                <div className="text-sm text-gray-600">{t("Best exchanges")}</div>
                <div className="font-semibold">{t("Meaningful dialogue")}</div>
              </div>
            </div>
            <div className={`bg-white/80 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                <div className="text-sm text-gray-600">{t("Good practices")}</div>
                <div className="font-semibold">{t("Learn by example")}</div>
              </div>
            </div>
            <div className={`bg-white/80 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <Users className="h-6 w-6 text-purple-500" />
              <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                <div className="text-sm text-gray-600">{t("Community stars")}</div>
                <div className="font-semibold">{t("Top contributors")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <TopConversationsList />
      </div>
      
      {/* Bottom CTA */}
      <div className="border-t border-gray-200 pt-8 mt-10">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{t("Want to be featured here?")}</h3>
          <p className="text-gray-600 mb-4">
            {t("Start quality discussions with other community members and apply the tips you've learned")}
          </p>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => navigate(createPageUrl("FindPartners"))}
          >
            <Users className={`h-5 w-5 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t("Find Discussion Partners")}
            <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'mr-2 rotate-180' : 'ml-2'}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}