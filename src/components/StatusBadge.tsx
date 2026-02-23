import { AgentStatus } from "@/types/requirement";
import { cn } from "@/lib/utils";

const statusConfig: Record<AgentStatus, { label: string; dotClass: string; bgClass: string }> = {
  pending: { label: "Pending", dotClass: "bg-status-pending", bgClass: "bg-status-pending/10 text-muted-foreground" },
  "in-progress": { label: "In Progress", dotClass: "bg-status-in-progress status-pulse", bgClass: "bg-status-in-progress/10 text-status-in-progress" },
  completed: { label: "Completed", dotClass: "bg-status-completed", bgClass: "bg-status-completed/10 text-status-completed" },
  failed: { label: "Failed", dotClass: "bg-status-failed", bgClass: "bg-status-failed/10 text-status-failed" },
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono", config.bgClass)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </span>
  );
}
