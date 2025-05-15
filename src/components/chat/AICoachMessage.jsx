import React from "react";
import { Badge } from "@/components/ui/badge";
import { Check, Info } from "lucide-react";
import { useLanguage } from '@/components/utils/i18n';

// Move languageSpecificContent outside the function to be reusable
const languageSpecificContent = {
  en: {
    intro: "Analyze this message in the context of a respectful discussion:",
    scoreLabels: {
      empathy: "Empathy",
      clarity: "Clarity",
      open_mindedness: "Open Mindedness"
    },
    biasesLabel: "Biases detected:",
    noBiases: "None detected",
    analysisTitle: "AI Coach Analysis",
    tips: "Improvement tips"
  },
  he: {
    intro: "נתח את ההודעה הזו בהקשר של דיון מכבד:",
    scoreLabels: {
      empathy: "אמפתיה",
      clarity: "בהירות",
      open_mindedness: "פתיחות מחשבתית"
    },
    biasesLabel: "הטיות שזוהו:",
    noBiases: "לא זוהו הטיות",
    analysisTitle: "ניתוח מאמן בינה מלאכותית",
    tips: "טיפים לשיפור"
  },
  ar: {
    intro: "تحليل هذه الرسالة في سياق مناقشة محترمة:",
    scoreLabels: {
      empathy: "التعاطف",
      clarity: "الوضوح",
      open_mindedness: "العقلية المنفتحة"
    },
    biasesLabel: "التحيزات المكتشفة:",
    noBiases: "لم يتم اكتشاف أي تحيز",
    analysisTitle: "تحليل مدرب الذكاء الاصطناعي",
    tips: "نصائح للتحسين"
  }
};

export default function AICoachMessage({ messageAnalysis }) {
  const { currentLanguage, direction } = useLanguage();
  
  // Get the appropriate content based on language, fallback to English if not available
  const content = languageSpecificContent[currentLanguage] || languageSpecificContent.en;

  // Check if analysis data is available
  if (!messageAnalysis || !messageAnalysis.score_explanation) {
    return null;
  }

  const { score_change, biases_detected, analysis_feedback, analysis_tips } = messageAnalysis;
  const hasBiases = biases_detected && biases_detected.length > 0;

  return (
    <div className={`bg-indigo-50 rounded-xl p-4 my-4 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-indigo-800 flex items-center">
          <Info className="w-4 h-4 mr-1" />
          {content.analysisTitle}
        </h3>
      </div>

      <div className="flex flex-wrap mb-4">
        <ScoreTag 
          score={score_change.open_mindedness}
          label={content.scoreLabels.open_mindedness}
        />
        <ScoreTag 
          score={score_change.clarity} 
          label={content.scoreLabels.clarity}
        />
        <ScoreTag 
          score={score_change.empathy}
          label={content.scoreLabels.empathy}
        />
      </div>

      <div className="mb-3">
        <div className="text-indigo-900 font-medium">{content.biasesLabel}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {hasBiases ? (
            biases_detected.map((bias, index) => (
              <Badge
                key={index}
                variant="outline"
                className={`bg-red-50 text-red-700 border-red-200 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}
              >
                {bias}
              </Badge>
            ))
          ) : (
            <Badge
              variant="outline"
              className={`bg-green-50 text-green-700 border-green-200 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}
            >
              <Check className="w-3 h-3 mr-1" />
              {content.noBiases}
            </Badge>
          )}
        </div>
      </div>

      <div className="text-gray-700 whitespace-pre-wrap mb-3">
        {analysis_feedback}
      </div>

      {analysis_tips && (
        <div>
          <div className="text-indigo-900 font-medium">
            {currentLanguage === 'he' ? 'טיפים לשיפור:' : 'Tips for improvement:'}
          </div>
          <div className="text-gray-700 whitespace-pre-wrap">
            {analysis_tips}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreTag({ score, label }) {
  const { direction } = useLanguage();
  
  let color;
  if (score >= 8) color = "bg-green-50 text-green-700 border-green-200";
  else if (score >= 5) color = "bg-blue-50 text-blue-700 border-blue-200";
  else if (score >= 1) color = "bg-yellow-50 text-yellow-700 border-yellow-200";
  else color = "bg-red-50 text-red-700 border-red-200";

  return (
    <div className={`flex flex-col items-center ${direction === 'rtl' ? 'ml-4' : 'mr-4'} mb-2`}>
      <div className={`text-lg font-semibold ${score >= 5 ? "text-indigo-700" : "text-gray-700"}`}>
        {score}+
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}