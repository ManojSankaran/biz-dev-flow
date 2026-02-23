import { useState } from "react";
import { Requirement, AgentStatus } from "@/types/requirement";
import { AgentPipeline } from "./AgentPipeline";
import { StatusBadge } from "./StatusBadge";
import { ChevronDown, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityConfig: Record<Requirement["priority"], { icon: React.ElementType; class: string; label: string }> = {
  critical: { icon: AlertTriangle, class: "text-status-failed", label: "Critical" },
  high: { icon: ArrowUp, class: "text-status-in-progress", label: "High" },
  medium: { icon: Minus, class: "text-primary", label: "Medium" },
  low: { icon: ArrowDown, class: "text-muted-foreground", label: "Low" },
};

function getOverallStatus(agents: Requirement["agents"]): AgentStatus {
  if (agents.some((a) => a.status === "failed")) return "failed";
  if (agents.every((a) => a.status === "completed")) return "completed";
  if (agents.some((a) => a.status === "in-progress")) return "in-progress";
  return "pending";
}

interface Props {
  requirement: Requirement;
  onStatusChange: (agentId: string, status: AgentStatus) => void;
}

export function RequirementCard({ requirement, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const overall = getOverallStatus(requirement.agents);
  const completedCount = requirement.agents.filter((a) => a.status === "completed").length;
  const PriorityIcon = priorityConfig[requirement.priority].icon;

  return (
    <div className={cn("rounded-lg border bg-card transition-all", expanded && "glow-primary")}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/30 transition-colors rounded-lg"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-card-foreground truncate">{requirement.title}</h3>
            <PriorityIcon className={cn("h-4 w-4 flex-shrink-0", priorityConfig[requirement.priority].class)} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{requirement.description}</p>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(completedCount / requirement.agents.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {completedCount}/{requirement.agents.length}
            </span>
          </div>

          <StatusBadge status={overall} />

          <span className="text-xs text-muted-foreground font-mono hidden md:block">
            {requirement.createdAt}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-border">
          <AgentPipeline agents={requirement.agents} onStatusChange={onStatusChange} />
        </div>
      )}
    </div>
  );
}
