import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, X, Search } from "lucide-react";
import { Topic } from "@/api/entities";
import { useLanguage } from "@/components/utils/i18n";
import { Input } from "@/components/ui/input";

export default function InterestsStep({ onNext, onBack }) {
  const { t, currentLanguage } = useLanguage();
  const [topics, setTopics] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState([currentLanguage]);
  const [searchTerm, setSearchTerm] = useState("");

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'he', name: 'עברית' },
    { code: 'ar', name: 'العربية' }
  ];

  React.useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const topicsData = await Topic.list();
      setTopics(topicsData);
    } catch (error) {
      console.error("Error loading topics:", error);
      setError(t("error_loading_topics"));
    } finally {
      setIsLoading(false);
    }
  };

  // Language-specific tags mapping (if we know tag translations)
  const tagTranslations = {
    en: {
      'חינוך': 'education',
      'סביבה': 'environment',
      'אתיקה': 'ethics',
      'טכנולוגיה': 'technology',
      'כלכלה': 'economics',
      'פוליטיקה': 'politics',
      'חברה': 'society',
      'בריאות': 'health',
      'אמנות': 'art',
      'מדע': 'science'
    },
    he: {
      'education': 'חינוך',
      'environment': 'סביבה',
      'ethics': 'אתיקה',
      'technology': 'טכנולוגיה',
      'economics': 'כלכלה',
      'politics': 'פוליטיקה',
      'society': 'חברה',
      'health': 'בריאות',
      'art': 'אמנות', 
      'science': 'מדע'
    },
    ar: {
      'education': 'تعليم',
      'environment': 'بيئة',
      'ethics': 'أخلاق',
      'technology': 'تكنولوجيا',
      'economics': 'اقتصاد',
      'politics': 'سياسة',
      'society': 'مجتمع',
      'health': 'صحة',
      'art': 'فن',
      'science': 'علوم'
    }
  };

  // Enhanced tag filtering system that is multi-language aware
  const filteredTags = useMemo(() => {
    // If no languages selected, show nothing
    if (selectedLanguages.length === 0) {
      return [];
    }
    
    // Step 1: Filter topics by selected languages
    const languageTopics = topics.filter(topic => {
      // Match explicit language property
      if (topic.language && selectedLanguages.includes(topic.language)) {
        return true;
      }
      
      // Match language tags
      if (topic.tags) {
        return selectedLanguages.some(lang => 
          topic.tags.some(tag => 
            tag === `lang:${lang}` || 
            tag === lang
          )
        );
      }
      
      return false;
    });
    
    // Step 2: Collect tags from language-filtered topics
    const languageTags = new Set();
    languageTopics.forEach(topic => {
      if (topic.tags && Array.isArray(topic.tags)) {
        // Filter out language tags and collect the rest
        const contentTags = topic.tags.filter(tag => 
          !tag.startsWith('lang:') && 
          !['he', 'ar', 'en'].includes(tag)
        );
        contentTags.forEach(tag => languageTags.add(tag));
      }
    });
    
    // Step 3: If we don't have enough tags (less than 10), add translated ones
    let finalTags = Array.from(languageTags);
    
    if (finalTags.length < 10) {
      // Find tags in other languages and translate them if possible
      const allContentTags = new Set();
      topics.forEach(topic => {
        if (topic.tags && Array.isArray(topic.tags)) {
          const contentTags = topic.tags.filter(tag => 
            !tag.startsWith('lang:') && 
            !['he', 'ar', 'en'].includes(tag)
          );
          contentTags.forEach(tag => allContentTags.add(tag));
        }
      });
      
      // Add translated versions of tags
      Array.from(allContentTags).forEach(tag => {
        // Try to translate to each selected language
        selectedLanguages.forEach(lang => {
          const translatedTag = tagTranslations[lang]?.[tag];
          if (translatedTag && !languageTags.has(translatedTag)) {
            languageTags.add(translatedTag);
          }
        });
      });
      
      finalTags = Array.from(languageTags);
    }

    // Step 4: Filter by search term
    let searchedTags = finalTags;
    if (searchTerm.trim() !== "") {
      searchedTags = finalTags.filter(tag =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Step 5: Sort alphabetically (basic sort, can be improved with localeCompare)
    return searchedTags.sort();
  }, [topics, selectedLanguages, searchTerm]);

  const handleTagSelect = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      if (selectedTags.length < 5) {
        setSelectedTags([...selectedTags, tag]);
      }
    }
  };

  const handleLanguageSelect = (lang) => {
    setSelectedLanguages(prev =>
      prev.includes(lang)
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    );
  };

  const handleNextWithTags = () => {
    onNext(selectedTags);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('choose_your_interests')}</h2>
        <p className="text-gray-600 mt-1">{t('select_interests_description')}</p>
      </div>

      {/* Language Filter - Now styled like the Topics page with multiple selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('filter_by_language')}
        </label>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguages.includes(lang.code) ? "default" : "ghost"}
              onClick={() => handleLanguageSelect(lang.code)}
              className={`${
                selectedLanguages.includes(lang.code)
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "hover:bg-gray-50"
              } text-sm`}
              size="sm"
            >
              {lang.name}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Search Bar for Tags */}
      <div className="relative">
        <Input
          type="text"
          placeholder={t('search_tags')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {/* Tags Selection */}
      <div className="space-y-4">
        {isLoading ? (
          <p>{t('loading')}...</p>
        ) : error ? (
          <div className="text-red-500 flex items-center">
            <AlertCircle className="mr-2 h-4 w-4" />
            {error}
          </div>
        ) : filteredTags.length === 0 ? (
          <p className="text-gray-500">{t('no_tags_available')}</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
            {filteredTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                onClick={() => handleTagSelect(tag)}
                className={`${
                  selectedTags.includes(tag)
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-white hover:bg-gray-50"
                }`}
                size="sm"
                disabled={selectedTags.length >= 5 && !selectedTags.includes(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        )}

        {/* Selected Tags Summary */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            {t('your_selected_interests')} ({selectedTags.length}/5)
          </label>
          <div className="min-h-12 bg-gray-50 rounded-lg p-2 flex flex-wrap gap-2">
            {selectedTags.length === 0 ? (
              <p className="text-gray-400 text-sm italic">{t('no_interests_selected_yet')}</p>
            ) : (
              selectedTags.map(tag => (
                <Badge 
                  key={tag} 
                  variant="secondary"
                  className="bg-indigo-100 text-indigo-700 px-2 py-1"
                >
                  {tag}
                  <X 
                    className="h-3 w-3 ml-1.5 cursor-pointer hover:text-indigo-500" 
                    onClick={() => handleTagSelect(tag)}
                  />
                </Badge>
              ))
            )}
          </div>
          {selectedTags.length >= 5 && (
            <p className="text-xs text-red-500 mt-1">{t('max_interests_reached')}</p>
          )}
        </div>
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex space-x-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="w-1/2 text-lg py-6"
        >
          {t('back')}
        </Button>
        <Button
          onClick={handleNextWithTags}
          className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-lg py-6"
        >
          {t('lets_go')}
        </Button>
      </div>
    </div>
  );
}