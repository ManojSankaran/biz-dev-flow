import { useState } from "react";
import { AgentInfo, AgentStatus, APPROVAL_AGENTS, AGENT_OUTPUT_LABELS } from "@/types/requirement";
import { StatusBadge } from "./StatusBadge";
import { AgentOutputEditor } from "./AgentOutputEditor";
import { FileSearch, Blocks, Shield, Code, TestTube2, GitBranch, ChevronRight, Eye, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const iconMap: Record<string, React.ElementType> = {
  FileSearch, Blocks, Shield, Code, TestTube2, GitBranch,
};

interface AgentPipelineProps {
  agents: AgentInfo[];
  requirementId: string;
  onStatusChange: (agentId: string, status: AgentStatus) => void;
}

export function AgentPipeline({ agents, requirementId, onStatusChange }: AgentPipelineProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAgent, setPreviewAgent] = useState("");
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const viewAgentOutput = async (agentName: string) => {
    setPreviewAgent(agentName);
    setPreviewOpen(true);
    setPreviewContent(null);
    setLoadingPreview(true);
    try {
      const { data } = await supabase
        .from("agent_outputs")
        .select("content")
        .eq("requirement_id", requirementId)
        .eq("agent_name", agentName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setPreviewContent(data?.content || "No output available yet.");
    } catch {
      setPreviewContent("No output available for this agent yet.");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Pipeline visualization */}
        <div className="flex items-center gap-1 overflow-x-auto pb-3 pt-2">
          {agents.map((agent, idx) => {
            const Icon = iconMap[agent.icon] || Code;
            const isActive = agent.status === "in-progress";
            const isDone = agent.status === "completed";
            const isFailed = agent.status === "failed";
            const isApprovalAgent = APPROVAL_AGENTS.includes(agent.name);

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
                    <Icon className={cn(
                      "h-4.5 w-4.5",
                      isActive && "text-status-in-progress",
                      isDone && "text-status-completed",
                      isFailed && "text-status-failed",
                      !isActive && !isDone && !isFailed && "text-muted-foreground"
                    )} />
                  </div>
                  <span className="text-xs font-semibold text-card-foreground text-center leading-tight">
                    {agent.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{agent.role}</span>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={agent.status} size="xs" />
                    {isApprovalAgent && (
                      <span className="text-[8px] font-mono text-primary bg-primary/10 rounded px-1 py-0.5">APPROVAL</span>
                    )}
                  </div>
                  {(isDone || isActive) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-[10px] gap-1 text-primary hover:text-primary"
                      onClick={() => viewAgentOutput(agent.name)}
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </Button>
                  )}
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
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Output</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, idx) => {
                const Icon = iconMap[agent.icon] || Code;
                const hasOutput = agent.status === "completed" || agent.status === "in-progress";
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
                      <div>
                        <span className="font-medium text-card-foreground">{agent.name}</span>
                        {APPROVAL_AGENTS.includes(agent.name) && (
                          <span className="ml-1.5 text-[9px] font-mono text-primary bg-primary/10 rounded px-1 py-0.5">APPROVAL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{agent.role}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={agent.status} />
                    </td>
                    <td className="px-4 py-3">
                      {hasOutput ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => viewAgentOutput(agent.name)}
                        >
                          <Eye className="h-3 w-3" />
                          {AGENT_OUTPUT_LABELS[agent.name] || "View Output"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

      {/* Agent Output Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{AGENT_OUTPUT_LABELS[previewAgent] || previewAgent} Output</DialogTitle>
          </DialogHeader>
          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-card-foreground text-sm leading-relaxed">
              {previewContent}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
