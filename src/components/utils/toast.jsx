import { useToast } from "@/components/ui/use-toast";

// Centralized toast utility that all components can import
export function useAppToast() {
  const { toast } = useToast();
  
  const showToast = (title, description = null, variant = "default", action = null) => {
    toast({
      title: <span className="font-semibold text-base">{title}</span>,
      description: description && <span className="text-sm opacity-90">{description}</span>,
      variant,
      action,
      className: "bg-white border-2 shadow-lg rounded-lg",
      style: {
        backgroundColor: "white",
        color: variant === "destructive" ? "#991B1B" : "#111827",
        border: variant === "destructive" ? "2px solid #fee2e2" : "2px solid #e2e8f0"
      }
    });
  };
  
  return { showToast };
}