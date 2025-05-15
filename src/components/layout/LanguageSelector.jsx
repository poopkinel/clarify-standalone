import React from 'react';
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AVAILABLE_LANGUAGES, useLanguage } from '@/components/utils/i18n';

export default function LanguageSelector({ variant = "default", className = "" }) {
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage();
  
  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    // Add a small delay to ensure the language is saved before refresh
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className={className}>
          <Globe className="h-4 w-4 mr-2" />
          {availableLanguages[currentLanguage]?.nativeName || 'Language'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={5} className="z-[100]">
        {Object.values(availableLanguages).map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`${currentLanguage === language.code ? 'bg-gray-100 font-medium' : ''}`}
          >
            <span className="mr-4 inline-block w-6 text-center">{language.code === 'he' ? '🇮🇱' : language.code === 'en' ? '🇺🇸' : '🌐'}</span>
            {language.nativeName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}