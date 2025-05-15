import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Globe } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

export default function TaskFilters({ onFilterChange }) {
  const { t } = useLanguage();
  const [status, setStatus] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [selectedLanguages, setSelectedLanguages] = React.useState([]);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'he', name: 'עברית' },
    { code: 'ar', name: 'العربية' }
  ];

  const handleLanguageSelect = (lang) => {
    const newSelectedLangs = selectedLanguages.includes(lang)
      ? selectedLanguages.filter(l => l !== lang)
      : [...selectedLanguages, lang];
    
    setSelectedLanguages(newSelectedLangs);
    handleFilterChange("languages", newSelectedLangs);
  };

  const handleFilterChange = (type, value) => {
    if (type === "status") setStatus(value);
    if (type === "priority") setPriority(value);
    if (type === "category") setCategory(value);
    onFilterChange({ 
      status: type === "status" ? value : status, 
      priority: type === "priority" ? value : priority,
      category: type === "category" ? value : category,
      languages: type === "languages" ? value : selectedLanguages
    });
  };

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {/* ... keep existing code ... */}

      {/* Add Language Filter */}
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{t('Languages')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguages.includes(lang.code) ? "default" : "outline"}
              onClick={() => handleLanguageSelect(lang.code)}
              className={`text-sm ${
                selectedLanguages.includes(lang.code)
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "hover:bg-gray-100"
              }`}
              size="sm"
            >
              {lang.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}