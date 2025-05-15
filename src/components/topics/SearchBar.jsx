import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from '@/components/utils/i18n';

export default function SearchBar({ topics, onSearchResults, onClearSearch, placeholder }) {
  const { t } = useLanguage();

  const handleSearch = (searchTerm) => {
    if (!searchTerm.trim()) {
      onClearSearch();
      return;
    }

    // Filter topics that match the search term
    const filteredTopics = topics.filter(topic => {
      const searchLower = searchTerm.toLowerCase();
      return (
        topic.title?.toLowerCase().includes(searchLower) ||
        topic.description?.toLowerCase().includes(searchLower) ||
        topic.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    });

    onSearchResults(filteredTopics);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder || t('search_topics_placeholder')}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-4 py-2 w-full"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
}