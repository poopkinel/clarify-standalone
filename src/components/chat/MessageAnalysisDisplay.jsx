import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n"; // Import useLanguage

// Define language-specific content directly in the component or import from a shared file
const languageSpecificContent = {
  en: {
    analysisTitle: "AI Coach Analysis",
    biasesLabel: "Biases detected:",
    noBiases: "None detected",
    tipsLabel: "Tips for improvement:",
    noAnalysis: "No detailed analysis available for this message.",
    noTips: "No improvement tips available.",
    scoreLabels: {
      empathy: "Empathy",
      clarity: "Clarity",
      open_mindedness: "Open Mindedness"
    }
  },
  he: {
    analysisTitle: "ניתוח מאמן AI",
    biasesLabel: "הטיות שזוהו:",
    noBiases: "לא זוהו הטיות",
    tipsLabel: "טיפים לשיפור:",
    noAnalysis: "אין ניתוח מפורט זמין להודעה זו.",
    noTips: "אין טיפים לשיפור זמינים.",
    scoreLabels: {
      empathy: "אמפתיה",
      clarity: "בהירות",
      open_mindedness: "פתיחות מחשבתית"
    }
  },
  ar: {
    analysisTitle: "تحليل مدرب الذكاء الاصطناعي",
    biasesLabel: "التحيزات المكتشفة:",
    noBiases: "لم يتم اكتشاف أي تحيزات",
    tipsLabel: "نصائح للتحسين:",
    noAnalysis: "لا يوجد تحليل مفصل متاح لهذه الرسالة.",
    noTips: "لا توجد نصائح تحسين متاحة.",
    scoreLabels: {
      empathy: "التعاطف",
      clarity: "الوضوح",
      open_mindedness: "العقل المنفتح"
    }
  }
};

export default function MessageAnalysisDisplay({ message }) {
  const { currentLanguage, direction } = useLanguage(); // Get language and direction
  
  // Select content based on current language, fallback to English
  const content = languageSpecificContent[currentLanguage] || languageSpecificContent.en;

  if (!message || !message.score_change) {
    // Optionally render a placeholder or null if no message/score data
    return null; 
  }

  return (
    <div className={`mt-2 mb-4 mx-2 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
      <Card className="bg-purple-50 border-purple-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-purple-800">
            <Brain className="h-4 w-4" />
            <span className="font-medium">{content.analysisTitle}</span>
          </div>
          
          {/* Score breakdown */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            {Object.entries(message.score_change || {}).map(([category, score]) => (
              <div key={category} className="bg-white rounded-lg p-2 text-center">
                <div className="font-medium text-purple-800">+{score}</div>
                <div className="text-xs text-gray-600 capitalize">
                  {content.scoreLabels[category.toLowerCase()] || category.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>

          {/* Biases detected */}
          <div>
            <div className="text-sm font-medium text-purple-800 mb-1">
              {content.biasesLabel}
            </div>
            <div className="flex flex-wrap gap-1">
              {message.biases_detected && message.biases_detected.length > 0 ? (
                message.biases_detected.map((bias, i) => (
                  <Badge 
                    key={i}
                    variant="outline" 
                    className="bg-red-50 text-red-800 border-red-200"
                  >
                    {bias}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                  {content.noBiases}
                </Badge>
              )}
            </div>
          </div>

          {/* Main feedback text */}
          <div className="bg-white rounded-lg p-3 text-sm text-gray-700">
            {message.analysis_feedback || content.noAnalysis}
          </div>

          {/* Improvement tips */}
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm font-medium text-purple-800 mb-1">
              {content.tipsLabel}
            </div>
            <div className="text-sm text-gray-700">
              {message.analysis_tips || content.noTips}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}