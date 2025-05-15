
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input"; 
import { ChevronUp, ChevronDown, Clock } from "lucide-react";
import { useLanguage } from '@/components/utils/i18n';
import { Loader2 } from "lucide-react";

export default function TimerSelector({ 
  duration, 
  unit, 
  onDurationChange, 
  onUnitChange, 
  className = "",
  onConfirm, // Add confirm handler prop
  confirmButtonText, // Add confirm button text prop
  isLoading = false // Add loading state prop
}) {
  const { t } = useLanguage();
  const [selectedUnit, setSelectedUnit] = useState(unit || "hours");
  const [selectedValue, setSelectedValue] = useState(duration || (selectedUnit === "hours" ? 24 : 1));
  const [isValid, setIsValid] = useState(true);

  // Update when props change
  useEffect(() => {
    if (unit) {
      setSelectedUnit(unit);
    }
    if (duration) {
      setSelectedValue(duration);
    }
  }, [unit, duration]);

  const handleUnitChange = (value) => {
    setSelectedUnit(value);
    if (onUnitChange) {
      onUnitChange(value);
    }
  };

  // Handle direct text input
  const handleValueChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      const numValue = value === "" ? 0 : parseInt(value, 10);
      
      // Set upper limits based on unit
      const maxValue = selectedUnit === "hours" ? 72 : 30;
      
      if (numValue >= 0 && numValue <= maxValue) {
        setSelectedValue(numValue);
        if (onDurationChange) {
          onDurationChange(numValue);
        }
        setIsValid(numValue > 0);
      }
    }
  };

  const increment = () => {
    const maxValue = selectedUnit === "hours" ? 72 : 30;
    if (selectedValue < maxValue) {
      const newValue = selectedValue + 1;
      setSelectedValue(newValue);
      if (onDurationChange) {
        onDurationChange(newValue);
      }
      setIsValid(true);
    }
  };

  const decrement = () => {
    if (selectedValue > 1) {
      const newValue = selectedValue - 1;
      setSelectedValue(newValue);
      if (onDurationChange) {
        onDurationChange(newValue);
      }
      setIsValid(newValue > 0);
    }
  };

  return (
    <div className={className}>
      <Tabs value={selectedUnit} onValueChange={handleUnitChange} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4 w-full bg-gray-100 p-1 rounded-lg">
          <TabsTrigger 
            value="hours"
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm
                       data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:text-gray-600
                       transition-all duration-200 rounded-md py-2.5 font-medium"
          >
            {t("Hours")}
          </TabsTrigger>
          <TabsTrigger 
            value="days"
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm
                       data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:text-gray-600
                       transition-all duration-200 rounded-md py-2.5 font-medium"
          >
            {t("Days")}
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={decrement}
            disabled={selectedValue <= 1}
            type="button"
            className="h-12 w-12"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
          
          <Input
            type="text"
            inputMode="numeric"
            value={selectedValue}
            onChange={handleValueChange}
            className="w-24 h-12 text-center text-2xl font-medium"
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={increment}
            disabled={selectedValue >= (selectedUnit === "hours" ? 72 : 30)}
            type="button"
            className="h-12 w-12"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        </div>
      </Tabs>
        
      <div className="text-center py-2">
        <span className="text-gray-600">
          {t("This conversation will last for")} 
          <strong className="text-gray-900 mx-1">
            {selectedValue} {selectedUnit === "hours" 
              ? (selectedValue === 1 ? t("hour") : t("hours")) 
              : (selectedValue === 1 ? t("day") : t("days"))
            }
          </strong>
        </span>
      </div>
        
      {onConfirm && (
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            {t("Cancel")}
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!isValid || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("Sending...")}
              </>
            ) : (
              confirmButtonText || t("Send Invitation")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
