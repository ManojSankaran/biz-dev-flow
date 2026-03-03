import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Requirement, WorkflowStatus } from "@/types/requirement";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import {
  CheckCircle2, Clock, AlertTriangle, ArrowRight, TrendingUp,
  Activity, Zap, Shield, Users, GitBranch, Layers,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  user_id: string;
}

interface Props {
  projectId: string;
  requirements: Requirement[];
}

const WORKFLOW_STEPS: { key: WorkflowStatus; label: string; icon: React.ElementType }[] = [
  { key: "pending_ba_approval", label: "BA Review", icon: Clock },
  { key: "ba_approved", label: "BA Approved", icon: CheckCircle2 },
  { key: "generating_design", label: "Designing", icon: Zap },
  { key: "pending_architect_approval", label: "Arch Review", icon: Shield },
  { key: "architect_approved", label: "Arch Approved", icon: CheckCircle2 },
  { key: "in_development", label: "In Dev", icon: GitBranch },
  { key: "completed", label: "Done", icon: CheckCircle2 },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(230, 14%, 40%)",
  "in-progress": "hsl(38, 95%, 55%)",
  completed: "hsl(155, 75%, 45%)",
  failed: "hsl(0, 72%, 55%)",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "hsl(0, 72%, 55%)",
  high: "hsl(38, 95%, 55%)",
  medium: "hsl(260, 85%, 65%)",
  low: "hsl(230, 14%, 40%)",
};

export function ProjectActivityDashboard({ projectId, requirements }: Props) {
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    supabase
      .from("audit_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (data) setAuditLogs(data as AuditEntry[]);
      });
  }, [projectId]);

  const allAgents = requirements.flatMap((r) => r.agents);
  const totalAgents = allAgents.length;
  const completedAgents = allAgents.filter((a) => a.status === "completed").length;
  const failedAgents = allAgents.filter((a) => a.status === "failed").length;
  const inProgressAgents = allAgents.filter((a) => a.status === "in-progress").length;
  const overallCompletion = totalAgents > 0 ? Math.round((completedAgents / totalAgents) * 100) : 0;

  // Workflow funnel data
  const workflowCounts = WORKFLOW_STEPS.map((step) => ({
    ...step,
    count: requirements.filter((r) => r.workflowStatus === step.key).length,
  }));

  // Priority breakdown
  const priorityData = (["critical", "high", "medium", "low"] as const)
    .map((p) => ({
      name: p.charAt(0).toUpperCase() + p.slice(1),
      value: requirements.filter((r) => r.priority === p).length,
      fill: PRIORITY_COLORS[p],
    }))
    .filter((d) => d.value > 0);

  // Agent performance
  const agentRoles = ["Business Analyst", "Technical Architect", "Admin Agent", "Developer Agent", "QA Agent", "DevOps Agent"];
  const agentPerformance = agentRoles.map((role) => {
    const agents = allAgents.filter((a) => a.name === role);
    const done = agents.filter((a) => a.status === "completed").length;
    return {
      name: role.replace(" Agent", "").replace("Technical ", ""),
      completed: done,
      pending: agents.filter((a) => a.status === "pending").length,
      inProgress: agents.filter((a) => a.status === "in-progress").length,
      failed: agents.filter((a) => a.status === "failed").length,
    };
  });

  const cardClass = "rounded-xl border bg-card p-5";

  return (
    <div className="space-y-4">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Requirements", value: requirements.length, icon: Layers, color: "text-primary", bg: "bg-primary/10" },
          { label: "Completion", value: `${overallCompletion}%`, icon: TrendingUp, color: "text-status-completed", bg: "bg-status-completed/10" },
          { label: "In Progress", value: inProgressAgents, icon: Activity, color: "text-status-in-progress", bg: "bg-status-in-progress/10" },
          { label: "Issues", value: failedAgents, icon: AlertTriangle, color: "text-status-failed", bg: "bg-status-failed/10" },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            className={cardClass}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`h-6 w-6 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold font-mono text-card-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Workflow Funnel */}
      <motion.div
        className={cardClass}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Workflow Pipeline</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {workflowCounts.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.count > 0;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`flex flex-col items-center gap-1.5 rounded-lg px-3 py-2.5 min-w-[80px] transition-colors ${
                    isActive ? "bg-primary/10 border border-primary/20" : "bg-secondary/20 border border-transparent"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${isActive ? "text-card-foreground" : "text-muted-foreground/50"}`}>
                    {step.label}
                  </span>
                  <span className={`text-lg font-bold font-mono ${isActive ? "text-primary" : "text-muted-foreground/30"}`}>
                    {step.count}
                  </span>
                </div>
                {idx < workflowCounts.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority Distribution */}
        <motion.div
          className={cardClass}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Priority Distribution</h3>
          {priorityData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No requirements yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(230, 22%, 10%)", border: "1px solid hsl(230, 16%, 14%)", borderRadius: "8px", fontSize: "12px" }}
                  itemStyle={{ color: "hsl(220, 15%, 90%)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {priorityData.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
                <span className="text-[10px] text-muted-foreground">{p.name} ({p.value})</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          className={cardClass}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Recent Activity</h3>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet</p>
          ) : (
            <div className="space-y-0 max-h-[220px] overflow-y-auto pr-1">
              {auditLogs.slice(0, 8).map((log) => {
                const time = new Date(log.created_at);
                return (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-card-foreground truncate">
                        <span className="font-medium capitalize">{log.action.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground"> — {log.entity_type}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {time.toLocaleDateString([], { month: "short", day: "numeric" })} {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Agent Performance */}
      <motion.div
        className={cardClass}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Agent Performance</h3>
        {totalAgents === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No agents yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agentPerformance} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 16%, 14%)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(225, 10%, 45%)", fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: "hsl(225, 10%, 45%)", fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(230, 22%, 10%)", border: "1px solid hsl(230, 16%, 14%)", borderRadius: "8px", fontSize: "12px" }}
                itemStyle={{ color: "hsl(220, 15%, 90%)" }}
              />
              <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} />
              <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLORS["in-progress"]} />
              <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} />
              <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </div>
  );
}
