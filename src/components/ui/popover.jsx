import * as React from "react"

const PopoverContext = React.createContext({});

const Popover = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = ({ children, asChild }) => {
  const { open, setOpen } = React.useContext(PopoverContext);
  
  const handleClick = () => {
    setOpen(!open);
  };

  if (asChild) {
    return React.cloneElement(children, {
      onClick: handleClick,
      "aria-expanded": open,
      "aria-haspopup": true
    });
  }

  return (
    <button
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup={true}
    >
      {children}
    </button>
  );
};

const PopoverContent = ({ children, className = "", align = "center" }) => {
  const { open } = React.useContext(PopoverContext);
  
  if (!open) return null;

  const alignClass = align === "end" 
    ? "right-0" 
    : align === "start" 
    ? "left-0" 
    : "left-1/2 -translate-x-1/2";

  return (
    <div 
      className={`absolute z-50 mt-2 ${alignClass} bg-white rounded-md shadow-lg border border-gray-200 ${className}`}
      role="dialog"
    >
      {children}
    </div>
  );
};

export { Popover, PopoverTrigger, PopoverContent };