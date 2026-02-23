import { AgentInfo, AgentStatus } from "@/types/requirement";
import { StatusBadge } from "./StatusBadge";
import { FileSearch, Blocks, Shield, Code, TestTube2, GitBranch, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const iconMap: Record<string, React.ElementType> = {
  FileSearch,
  Blocks,
  Shield,
  Code,
  TestTube2,
  GitBranch,
};

interface AgentPipelineProps {
  agents: AgentInfo[];
  onStatusChange: (agentId: string, status: AgentStatus) => void;
}

export function AgentPipeline({ agents, onStatusChange }: AgentPipelineProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Pipeline visualization */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 pt-1">
        {agents.map((agent, idx) => {
          const Icon = iconMap[agent.icon] || Code;
          const isActive = agent.status === "in-progress";
          const isDone = agent.status === "completed";
          const isFailed = agent.status === "failed";

          return (
            <div key={agent.id} className="flex items-center">
              <div
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-4 py-3 min-w-[120px] transition-all",
                  isActive && "border-status-in-progress/40 bg-status-in-progress/5",
                  isDone && "border-status-completed/30 bg-status-completed/5",
                  isFailed && "border-status-failed/30 bg-status-failed/5",
                  !isActive && !isDone && !isFailed && "border-border bg-card"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive && "text-status-in-progress",
                    isDone && "text-status-completed",
                    isFailed && "text-status-failed",
                    !isActive && !isDone && !isFailed && "text-muted-foreground"
                  )}
                />
                <span className="text-xs font-medium text-card-foreground text-center leading-tight">
                  {agent.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">{agent.role}</span>
                <StatusBadge status={agent.status} />
              </div>
              {idx < agents.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Agent detail table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const Icon = iconMap[agent.icon] || Code;
              return (
                <tr key={agent.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{agent.name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{agent.role}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={agent.status}
                      onValueChange={(v) => onStatusChange(agent.id, v as AgentStatus)}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
