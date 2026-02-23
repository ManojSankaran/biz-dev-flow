import { AgentStatus } from "@/types/requirement";
import { cn } from "@/lib/utils";

const statusConfig: Record<AgentStatus, { label: string; dotClass: string; bgClass: string }> = {
  pending: {
    label: "Pending",
    dotClass: "bg-status-pending",
    bgClass: "bg-status-pending/10 text-muted-foreground border-status-pending/20",
  },
  "in-progress": {
    label: "In Progress",
    dotClass: "bg-status-in-progress status-pulse",
    bgClass: "bg-status-in-progress/10 text-status-in-progress border-status-in-progress/20",
  },
  completed: {
    label: "Completed",
    dotClass: "bg-status-completed",
    bgClass: "bg-status-completed/10 text-status-completed border-status-completed/20",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-status-failed",
    bgClass: "bg-status-failed/10 text-status-failed border-status-failed/20",
  },
};

export function StatusBadge({ status, size = "sm" }: { status: AgentStatus; size?: "sm" | "xs" }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium font-mono",
        config.bgClass,
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-2 py-0.5 text-[10px]"
      )}
    >
      <span className={cn("rounded-full", config.dotClass, size === "sm" ? "h-1.5 w-1.5" : "h-1 w-1")} />
      {config.label}
    </span>
  );
}
