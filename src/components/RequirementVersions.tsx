import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCommit, Clock } from "lucide-react";
import { format } from "date-fns";

interface Version {
  id: string;
  version_number: number;
  title: string;
  description: string | null;
  priority: string;
  workflow_status: string;
  change_reason: string | null;
  created_at: string;
}

interface RequirementVersionsProps {
  requirementId: string;
  requirementTitle: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending_ba_approval: "Pending BA",
  ba_approved: "BA Approved",
  generating_design: "Generating Design",
  pending_architect_approval: "Pending Architect",
  architect_approved: "Architect Approved",
  in_development: "In Development",
  completed: "Completed",
};

export function RequirementVersions({ requirementId, requirementTitle }: RequirementVersionsProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("requirement_versions" as any)
        .select("*")
        .eq("requirement_id", requirementId)
        .order("version_number", { ascending: false });
      setVersions((data as any) || []);
      setLoading(false);
    })();
  }, [requirementId]);

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }

  if (versions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No version history yet. Changes will be tracked automatically.</p>
    );
  }

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-2">
        {versions.map((v) => (
          <div key={v.id} className="rounded-lg border bg-secondary/10 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCommit className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-card-foreground">v{v.version_number}</span>
                <Badge variant="outline" className="text-[10px]">{v.priority}</Badge>
                <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[v.workflow_status] || v.workflow_status}</Badge>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                <Clock className="h-3 w-3" />
                {format(new Date(v.created_at), "MMM d, HH:mm")}
              </div>
            </div>
            <p className="text-xs text-card-foreground mt-1.5 font-medium">{v.title}</p>
            {v.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{v.description}</p>}
            {v.change_reason && <p className="text-[10px] text-primary mt-1 italic">Reason: {v.change_reason}</p>}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
