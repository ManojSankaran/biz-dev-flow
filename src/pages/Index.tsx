import { useRequirements } from "@/hooks/useRequirements";
import { RequirementCard } from "@/components/RequirementCard";
import { AddRequirementDialog } from "@/components/AddRequirementDialog";
import { Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const Index = () => {
  const { requirements, addRequirement, updateAgentStatus } = useRequirements();

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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AgentFlow</h1>
              <p className="text-xs text-muted-foreground font-mono">Requirements Tracker</p>
            </div>
          </div>
          <AddRequirementDialog onAdd={addRequirement} />
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Requirements", value: stats.total, icon: Activity, color: "text-primary" },
            { label: "Agents Done", value: stats.completed, icon: CheckCircle2, color: "text-status-completed" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-status-in-progress" },
            { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-status-failed" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono text-card-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Requirements List */}
        <div className="flex flex-col gap-3">
          {requirements.map((req) => (
            <RequirementCard
              key={req.id}
              requirement={req}
              onStatusChange={(agentId, status) => updateAgentStatus(req.id, agentId, status)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
