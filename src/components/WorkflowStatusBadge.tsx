import { cn } from "@/lib/utils";
import { Clock, CheckCircle, Loader2, Hammer, Pencil } from "lucide-react";

type WorkflowStatus =
  | "pending_ba_approval"
  | "ba_approved"
  | "generating_design"
  | "pending_architect_approval"
  | "architect_approved"
  | "in_development"
  | "completed";

const config: Record<WorkflowStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending_ba_approval: { label: "Awaiting BA Approval", icon: Clock, className: "bg-status-in-progress/10 text-status-in-progress border-status-in-progress/30" },
  ba_approved: { label: "BA Approved", icon: CheckCircle, className: "bg-status-completed/10 text-status-completed border-status-completed/30" },
  generating_design: { label: "Generating Design…", icon: Loader2, className: "bg-primary/10 text-primary border-primary/30" },
  pending_architect_approval: { label: "Awaiting Architect", icon: Pencil, className: "bg-accent-foreground/10 text-accent-foreground border-accent-foreground/30" },
  architect_approved: { label: "Architect Approved", icon: CheckCircle, className: "bg-status-completed/10 text-status-completed border-status-completed/30" },
  in_development: { label: "In Development", icon: Hammer, className: "bg-primary/10 text-primary border-primary/30" },
  completed: { label: "Completed", icon: CheckCircle, className: "bg-status-completed/10 text-status-completed border-status-completed/30" },
};

interface Props {
  status: string;
}

export function WorkflowStatusBadge({ status }: Props) {
  const c = config[status as WorkflowStatus] || config.pending_ba_approval;
  const Icon = c.icon;
  const isSpinning = status === "generating_design";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", c.className)}>
      <Icon className={cn("h-3 w-3", isSpinning && "animate-spin")} />
      {c.label}
    </span>
  );
}
