import { useState } from "react";
import { Requirement, AgentStatus } from "@/types/requirement";
import { AgentPipeline } from "./AgentPipeline";
import { StatusBadge } from "./StatusBadge";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Minus, Play, Trash2, CheckCircle, XCircle, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const priorityConfig: Record<Requirement["priority"], { icon: React.ElementType; class: string; label: string; bg: string }> = {
  critical: { icon: AlertTriangle, class: "text-status-failed", label: "Critical", bg: "bg-status-failed/10" },
  high: { icon: ArrowUp, class: "text-status-in-progress", label: "High", bg: "bg-status-in-progress/10" },
  medium: { icon: Minus, class: "text-primary", label: "Medium", bg: "bg-primary/10" },
  low: { icon: ArrowDown, class: "text-muted-foreground", label: "Low", bg: "bg-muted" },
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
  onAutoProgress: () => void;
  onDelete: () => void;
  onApproval?: () => void;
}

export function RequirementCard({ requirement, onStatusChange, onAutoProgress, onDelete, onApproval }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designContent, setDesignContent] = useState<string | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);
  const { toast } = useToast();

  const overall = getOverallStatus(requirement.agents);
  const completedCount = requirement.agents.filter((a) => a.status === "completed").length;
  const progress = (completedCount / requirement.agents.length) * 100;
  const PriorityIcon = priorityConfig[requirement.priority].icon;

  const canApprove = requirement.workflowStatus === "pending_ba_approval" || requirement.workflowStatus === "pending_architect_approval";
  const approvalLabel = requirement.workflowStatus === "pending_ba_approval" ? "BA Approve" : "Architect Approve";

  const handleApproval = async (action: "approve" | "reject") => {
    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke("approve-requirement", {
        body: { requirementId: requirement.id, action },
      });
      if (error) throw error;
      toast({
        title: action === "approve" ? "Approved" : "Rejected",
        description: action === "approve"
          ? `Requirement moved to next stage`
          : `Requirement sent back for revision`,
      });
      onApproval?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Approval failed", variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const viewDesign = async () => {
    setDesignOpen(true);
    if (designContent) return;
    setLoadingDesign(true);
    try {
      const { data } = await supabase
        .from("technical_designs")
        .select("content")
        .eq("requirement_id", requirement.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setDesignContent(data?.content || "No design document found.");
    } catch {
      setDesignContent("Failed to load design document.");
    } finally {
      setLoadingDesign(false);
    }
  };

  const hasDesign = ["pending_architect_approval", "architect_approved", "in_development", "completed"].includes(requirement.workflowStatus);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className={cn(
          "rounded-xl border bg-card transition-all duration-300",
          expanded && "glow-primary"
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors rounded-xl"
        >
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className={cn("h-4 w-4 flex-shrink-0", expanded ? "text-primary" : "text-muted-foreground")} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-card-foreground truncate">{requirement.title}</h3>
              <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium", priorityConfig[requirement.priority].bg, priorityConfig[requirement.priority].class)}>
                <PriorityIcon className="h-3 w-3" />
                {priorityConfig[requirement.priority].label}
              </span>
              <WorkflowStatusBadge status={requirement.workflowStatus} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{requirement.description}</p>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <div className="relative h-8 w-8">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="12" fill="none" className="stroke-muted" strokeWidth="3" />
                  <circle
                    cx="16" cy="16" r="12" fill="none"
                    className="stroke-primary transition-all duration-500"
                    strokeWidth="3"
                    strokeDasharray={`${progress * 0.754} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-card-foreground">
                  {completedCount}/{requirement.agents.length}
                </span>
              </div>
            </div>

            <StatusBadge status={overall} />

            <span className="text-xs text-muted-foreground font-mono hidden md:block">
              {requirement.createdAt}
            </span>
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-2 border-t border-border">
                {/* Action buttons */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {canApprove && (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs h-7 bg-status-completed hover:bg-status-completed/90 text-primary-foreground"
                        onClick={(e) => { e.stopPropagation(); handleApproval("approve"); }}
                        disabled={approving}
                      >
                        {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        {approvalLabel}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); handleApproval("reject"); }}
                        disabled={approving}
                      >
                        <XCircle className="h-3 w-3" />
                        Reject
                      </Button>
                    </>
                  )}
                  {hasDesign && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); viewDesign(); }}
                    >
                      <FileText className="h-3 w-3" />
                      View Design
                    </Button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); onAutoProgress(); }}
                      >
                        <Play className="h-3 w-3" />
                        Auto-Progress
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Simulate agents progressing automatically</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove this requirement</TooltipContent>
                  </Tooltip>
                </div>
                <AgentPipeline agents={requirement.agents} onStatusChange={onStatusChange} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Technical Design Dialog */}
      <Dialog open={designOpen} onOpenChange={setDesignOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Technical Design: {requirement.title}</DialogTitle>
          </DialogHeader>
          {loadingDesign ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-card-foreground text-sm leading-relaxed">
              {designContent}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
