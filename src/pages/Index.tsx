import { useState, useMemo } from "react";
import { useRequirements } from "@/hooks/useRequirements";
import { RequirementCard } from "@/components/RequirementCard";
import { AddRequirementDialog } from "@/components/AddRequirementDialog";
import { SearchFilterBar, PriorityFilter, StatusFilter, SortOption } from "@/components/SearchFilterBar";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { Activity, CheckCircle2, AlertCircle, Clock, BarChart3, History, LayoutList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { AgentStatus } from "@/types/requirement";

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function getOverallStatus(agents: { status: AgentStatus }[]): AgentStatus {
  if (agents.some((a) => a.status === "failed")) return "failed";
  if (agents.every((a) => a.status === "completed")) return "completed";
  if (agents.some((a) => a.status === "in-progress")) return "in-progress";
  return "pending";
}

const Index = () => {
  const { requirements, activityLog, addRequirement, updateAgentStatus, startAutoProgress, deleteRequirement } = useRequirements();

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const filteredRequirements = useMemo(() => {
    let result = requirements;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
      );
    }

    if (priorityFilter !== "all") {
      result = result.filter((r) => r.priority === priorityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => getOverallStatus(r.agents) === statusFilter);
    }

    const sorted = [...result];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "oldest":
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "priority":
        sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        break;
      case "progress":
        sorted.sort((a, b) => {
          const pa = a.agents.filter((ag) => ag.status === "completed").length / a.agents.length;
          const pb = b.agents.filter((ag) => ag.status === "completed").length / b.agents.length;
          return pb - pa;
        });
        break;
    }

    return sorted;
  }, [requirements, search, priorityFilter, statusFilter, sort]);

  const allAgents = requirements.flatMap((r) => r.agents);
  const stats = {
    total: requirements.length,
    completed: allAgents.filter((a) => a.status === "completed").length,
    inProgress: allAgents.filter((a) => a.status === "in-progress").length,
    failed: allAgents.filter((a) => a.status === "failed").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/60 glass sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center glow-sm">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">AgentFlow</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">Requirements Tracker</p>
            </div>
          </div>
          <AddRequirementDialog onAdd={addRequirement} />
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Requirements", value: stats.total, icon: Activity, color: "text-primary", bg: "bg-primary/10" },
            { label: "Agents Done", value: stats.completed, icon: CheckCircle2, color: "text-status-completed", bg: "bg-status-completed/10" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-status-in-progress", bg: "bg-status-in-progress/10" },
            { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-status-failed", bg: "bg-status-failed/10" },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              className="rounded-xl border bg-card px-4 py-3 hover:glow-sm transition-all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
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

        {/* Tabs */}
        <Tabs defaultValue="requirements" className="space-y-4">
          <TabsList className="bg-secondary/30 border border-border p-0.5">
            <TabsTrigger value="requirements" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <LayoutList className="h-3.5 w-3.5" />
              Requirements
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <History className="h-3.5 w-3.5" />
              Activity
              {activityLog.length > 0 && (
                <span className="ml-1 h-4 min-w-4 rounded-full bg-primary/20 text-primary text-[10px] font-mono flex items-center justify-center px-1">
                  {activityLog.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="space-y-4 mt-4">
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              priority={priorityFilter}
              onPriorityChange={setPriorityFilter}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              sort={sort}
              onSortChange={setSort}
            />

            <AnimatePresence mode="popLayout">
              {filteredRequirements.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-muted-foreground"
                >
                  <p className="text-sm">No requirements match your filters</p>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredRequirements.map((req) => (
                    <RequirementCard
                      key={req.id}
                      requirement={req}
                      onStatusChange={(agentId, status) => updateAgentStatus(req.id, agentId, status)}
                      onAutoProgress={() => startAutoProgress(req.id)}
                      onDelete={() => deleteRequirement(req.id)}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <AnalyticsDashboard requirements={requirements} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">Recent Activity</h3>
              <ActivityTimeline entries={activityLog} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
