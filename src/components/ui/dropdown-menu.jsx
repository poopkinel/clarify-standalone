import * as React from "react"
import { Button } from "@/components/ui/button"

const DropdownMenu = ({ children }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative inline-block">
      {React.Children.map(children, child => 
        React.cloneElement(child, { open, onOpenChange: setOpen })
      )}
    </div>
  )
}

const DropdownMenuTrigger = ({ children, open, onOpenChange, asChild }) => {
  const handleClick = () => {
    if (typeof onOpenChange === 'function') {
      onOpenChange(!open);
    }
  }

  if (asChild) {
    return React.cloneElement(children, {
      onClick: handleClick,
      "aria-expanded": open,
      "aria-haspopup": true
    })
  }

  return (
    <Button 
      onClick={handleClick} 
      aria-expanded={open}
      aria-haspopup={true}
    >
      {children}
    </Button>
  )
}

const DropdownMenuContent = ({ children, align = "center", open, className = "" }) => {
  if (!open) return null

  const alignClass = align === "end" 
    ? "right-0" 
    : align === "start" 
    ? "left-0" 
    : "left-1/2 -translate-x-1/2"

  return (
    <div 
      className={`absolute z-[100] mt-2 ${alignClass} min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md animate-in fade-in-80 ${className}`}
      role="menu"
    >
      <div className="p-1 w-full">
        {children}
      </div>
    </div>
  )
}

const DropdownMenuItem = React.forwardRef(({ onClick, className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 ${className || ""}`}
      onClick={onClick}
      role="menuitem"
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem }