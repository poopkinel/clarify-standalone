import React from "react";
import { useLanguage } from '@/components/utils/i18n';

const Tabs = ({ defaultValue, value, onValueChange, className = "", children }) => {
  const [selectedTab, setSelectedTab] = React.useState(value || defaultValue);
  const { direction } = useLanguage();
  
  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedTab(value);
    }
  }, [value]);
  
  const handleValueChange = (newValue) => {
    if (value === undefined) {
      setSelectedTab(newValue);
    }
    onValueChange?.(newValue);
  };
  
  return (
    <div className={className} data-orientation="horizontal" dir={direction}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        
        // Clone and pass the selected value to TabsList and TabsContent
        return React.cloneElement(child, {
          selectedValue: selectedTab,
          onSelect: handleValueChange,
        });
      })}
    </div>
  );
};

const TabsList = ({ selectedValue, onSelect, className = "", children }) => {
  return (
    <div className={`flex ${className}`} role="tablist">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          selected: child.props.value === selectedValue,
          onSelect,
        });
      })}
    </div>
  );
};

const TabsTrigger = ({ value, selected, onSelect, className = "", children }) => {
  return (
    <button
      role="tab"
      className={`${className} ${selected ? 'data-[state=active]' : ''}`}
      data-state={selected ? "active" : "inactive"}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, selectedValue, className = "", children }) => {
  const isSelected = value === selectedValue;
  
  if (!isSelected) return null;
  
  return (
    <div className={className} role="tabpanel" data-state={isSelected ? "active" : "inactive"}>
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };