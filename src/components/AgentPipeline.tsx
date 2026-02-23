import { AgentInfo, AgentStatus } from "@/types/requirement";
import { StatusBadge } from "./StatusBadge";
import { FileSearch, Blocks, Shield, Code, TestTube2, GitBranch, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const iconMap: Record<string, React.ElementType> = {
  FileSearch, Blocks, Shield, Code, TestTube2, GitBranch,
};

interface AgentPipelineProps {
  agents: AgentInfo[];
  onStatusChange: (agentId: string, status: AgentStatus) => void;
}

export function AgentPipeline({ agents, onStatusChange }: AgentPipelineProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline visualization */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 pt-2">
        {agents.map((agent, idx) => {
          const Icon = iconMap[agent.icon] || Code;
          const isActive = agent.status === "in-progress";
          const isDone = agent.status === "completed";
          const isFailed = agent.status === "failed";

          return (
            <motion.div
              key={agent.id}
              className="flex items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.3 }}
            >
              <div
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border px-4 py-3 min-w-[130px] transition-all duration-300",
                  isActive && "border-status-in-progress/40 bg-status-in-progress/5 glow-sm",
                  isDone && "border-status-completed/30 bg-status-completed/5",
                  isFailed && "border-status-failed/30 bg-status-failed/5",
                  !isActive && !isDone && !isFailed && "border-border bg-secondary/30"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                  isActive && "bg-status-in-progress/15",
                  isDone && "bg-status-completed/15",
                  isFailed && "bg-status-failed/15",
                  !isActive && !isDone && !isFailed && "bg-muted"
                )}>
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5",
                      isActive && "text-status-in-progress",
                      isDone && "text-status-completed",
                      isFailed && "text-status-failed",
                      !isActive && !isDone && !isFailed && "text-muted-foreground"
                    )}
                  />
                </div>
                <span className="text-xs font-semibold text-card-foreground text-center leading-tight">
                  {agent.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">{agent.role}</span>
                <StatusBadge status={agent.status} size="xs" />
              </div>
              {idx < agents.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className={cn(
                    "h-px w-4 transition-colors",
                    isDone ? "bg-status-completed/40" : "bg-border"
                  )} />
                  <ChevronRight className={cn(
                    "h-3 w-3 flex-shrink-0",
                    isDone ? "text-status-completed/40" : "text-muted-foreground/40"
                  )} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Agent detail table */}
      <div className="rounded-xl border bg-secondary/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, idx) => {
              const Icon = iconMap[agent.icon] || Code;
              return (
                <motion.tr
                  key={agent.id}
                  className="border-b last:border-0 hover:bg-secondary/40 transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <td className="px-4 py-3 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-card-foreground">{agent.name}</span>
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
                      <SelectTrigger className="h-7 w-[130px] text-xs bg-muted/50 border-border">
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
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
