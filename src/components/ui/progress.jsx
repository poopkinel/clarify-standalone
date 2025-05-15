import * as React from "react"

const Progress = React.forwardRef(({ value, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-100 ${className}`}
    >
      <div
        className="h-full w-full flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  )
})
Progress.displayName = "Progress"

export { Progress }