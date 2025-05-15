import React from "react";
import { Button } from "@/components/ui/button";
import { Users, Book } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n"; // Import useLanguage
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PostOpinionDialog({ isOpen, onClose, onFindPartners, onExploreTopics }) {
  const { t } = useLanguage(); // Get the translation function
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            {t("opinion_shared_successfully")} {/* Use translation */}
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            {t("thanks_for_sharing")} {/* Use translation */}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button
            onClick={onFindPartners}
            className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Users className="mr-2 h-5 w-5" />
            {t("find_discussion_partners")} {/* Use translation */}
          </Button>
          
          <Button
            onClick={onExploreTopics}
            variant="outline"
            className="w-full py-6 border-gray-200 hover:bg-gray-50 text-gray-800"
          >
            <Book className="mr-2 h-5 w-5" />
            {t("continue_exploring_topics")} {/* Use translation */}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}