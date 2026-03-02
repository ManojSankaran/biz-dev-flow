import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, History, FileText, Users, GitBranch, CheckCircle, AlertCircle, Settings, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
  user_id: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  requirement: <FileText className="h-3.5 w-3.5 text-primary" />,
  stakeholder: <Users className="h-3.5 w-3.5 text-accent-foreground" />,
  artifact: <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />,
  approval: <CheckCircle className="h-3.5 w-3.5 text-primary" />,
  scoping: <MessageSquare className="h-3.5 w-3.5 text-primary" />,
  project: <Settings className="h-3.5 w-3.5 text-muted-foreground" />,
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  approved: "Approved",
  rejected: "Rejected",
  started: "Started",
  completed: "Completed",
  status_change: "Status Changed",
};

interface AuditLogProps {
  projectId: string;
}

export function AuditLog({ projectId }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as any) || []);
      setLoading(false);
    })();
  }, [projectId]);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.entity_type === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Audit Trail</h3>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary/30 px-1.5 py-0.5 rounded">{logs.length}</span>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="requirement">Requirements</SelectItem>
            <SelectItem value="approval">Approvals</SelectItem>
            <SelectItem value="scoping">Scoping</SelectItem>
            <SelectItem value="stakeholder">Stakeholders</SelectItem>
            <SelectItem value="artifact">Artifacts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No audit events recorded yet.</p>
          <p className="text-xs mt-1">Actions like approvals, edits, and status changes will appear here.</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/10 transition-colors">
                <div className="flex-shrink-0 mt-0.5 rounded-full bg-secondary/20 h-7 w-7 flex items-center justify-center">
                  {ACTION_ICONS[log.entity_type] || <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-card-foreground">
                    <span className="font-medium">{ACTION_LABELS[log.action] || log.action}</span>
                    {" "}
                    <span className="text-muted-foreground">{log.entity_type}</span>
                    {log.details?.title && (
                      <span className="text-muted-foreground"> — {log.details.title}</span>
                    )}
                  </p>
                  {log.details?.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
