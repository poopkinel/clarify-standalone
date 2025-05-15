import * as React from "react"

const TooltipProvider = ({ children }) => {
  return <>{children}</>
}

const Tooltip = ({ children }) => {
  return <>{children}</>
}

const TooltipTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef(({ className, children, ...props }, ref) => {
  return null // We don't actually render tooltip content since we don't have Radix UI
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
export default { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }