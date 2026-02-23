import { Requirement } from "@/types/requirement";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend,
} from "recharts";
import { motion } from "framer-motion";

interface Props {
  requirements: Requirement[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(230, 14%, 40%)",
  "in-progress": "hsl(38, 95%, 55%)",
  completed: "hsl(155, 75%, 45%)",
  failed: "hsl(0, 72%, 55%)",
};

export function AnalyticsDashboard({ requirements }: Props) {
  const allAgents = requirements.flatMap((r) => r.agents);

  // Overall status distribution
  const statusData = [
    { name: "Pending", value: allAgents.filter((a) => a.status === "pending").length, fill: STATUS_COLORS.pending },
    { name: "In Progress", value: allAgents.filter((a) => a.status === "in-progress").length, fill: STATUS_COLORS["in-progress"] },
    { name: "Completed", value: allAgents.filter((a) => a.status === "completed").length, fill: STATUS_COLORS.completed },
    { name: "Failed", value: allAgents.filter((a) => a.status === "failed").length, fill: STATUS_COLORS.failed },
  ].filter(d => d.value > 0);

  // Per-requirement progress
  const reqProgressData = requirements.map((r) => ({
    name: r.title.length > 18 ? r.title.slice(0, 18) + "…" : r.title,
    completed: r.agents.filter((a) => a.status === "completed").length,
    inProgress: r.agents.filter((a) => a.status === "in-progress").length,
    pending: r.agents.filter((a) => a.status === "pending").length,
    failed: r.agents.filter((a) => a.status === "failed").length,
  }));

  // Agent role performance
  const agentRoles = ["Business Analyst", "Technical Architect", "Admin Agent", "Developer Agent", "QA Agent", "DevOps Agent"];
  const agentPerformance = agentRoles.map((role) => {
    const agents = allAgents.filter((a) => a.name === role);
    const completed = agents.filter((a) => a.status === "completed").length;
    return {
      name: role.replace(" Agent", ""),
      completion: agents.length > 0 ? Math.round((completed / agents.length) * 100) : 0,
      fill: `hsl(${260 + agentRoles.indexOf(role) * 15}, 70%, ${55 + agentRoles.indexOf(role) * 3}%)`,
    };
  });

  // Priority breakdown
  const priorityData = [
    { name: "Critical", value: requirements.filter((r) => r.priority === "critical").length, fill: STATUS_COLORS.failed },
    { name: "High", value: requirements.filter((r) => r.priority === "high").length, fill: STATUS_COLORS["in-progress"] },
    { name: "Medium", value: requirements.filter((r) => r.priority === "medium").length, fill: "hsl(260, 85%, 65%)" },
    { name: "Low", value: requirements.filter((r) => r.priority === "low").length, fill: STATUS_COLORS.pending },
  ].filter(d => d.value > 0);

  const overallCompletion = allAgents.length > 0
    ? Math.round((allAgents.filter((a) => a.status === "completed").length / allAgents.length) * 100)
    : 0;

  const cardClass = "rounded-xl border bg-card p-5";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Overall completion */}
      <motion.div
        className={cardClass}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Overall Completion</h3>
        <div className="flex items-center justify-center gap-8">
          <div className="relative">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" className="stroke-muted" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="hsl(260, 85%, 65%)"
                strokeWidth="10"
                strokeDasharray={`${overallCompletion * 3.14} 314`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono text-card-foreground">{overallCompletion}%</span>
              <span className="text-[10px] text-muted-foreground">Complete</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="text-xs text-muted-foreground">{s.name}</span>
                <span className="text-xs font-mono font-bold text-card-foreground ml-auto">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Priority Distribution */}
      <motion.div
        className={cardClass}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Priority Distribution</h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={priorityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
              {priorityData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(230, 22%, 10%)", border: "1px solid hsl(230, 16%, 14%)", borderRadius: "8px", fontSize: "12px" }}
              itemStyle={{ color: "hsl(220, 15%, 90%)" }}
            />
            <Legend
              formatter={(value) => <span style={{ color: "hsl(225, 10%, 45%)", fontSize: "11px" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Requirement Progress */}
      <motion.div
        className={`${cardClass} lg:col-span-2`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Requirement Progress</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={reqProgressData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 16%, 14%)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "hsl(225, 10%, 45%)", fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: "hsl(225, 10%, 45%)", fontSize: 11 }} width={130} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(230, 22%, 10%)", border: "1px solid hsl(230, 16%, 14%)", borderRadius: "8px", fontSize: "12px" }}
              itemStyle={{ color: "hsl(220, 15%, 90%)" }}
            />
            <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 0, 0, 0]} />
            <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLORS["in-progress"]} />
            <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} />
            <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Agent Performance */}
      <motion.div
        className={`${cardClass} lg:col-span-2`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Agent Completion Rate</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={agentPerformance}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 16%, 14%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(225, 10%, 45%)", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(225, 10%, 45%)", fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(230, 22%, 10%)", border: "1px solid hsl(230, 16%, 14%)", borderRadius: "8px", fontSize: "12px" }}
              formatter={(value: number) => [`${value}%`, "Completion"]}
              itemStyle={{ color: "hsl(220, 15%, 90%)" }}
            />
            <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
              {agentPerformance.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
