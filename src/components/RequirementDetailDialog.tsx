import { useState } from "react";
import { Requirement, AgentStatus, WorkflowStatus } from "@/types/requirement";
import { AgentPipeline } from "./AgentPipeline";
import { StatusBadge } from "./StatusBadge";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X, Loader2, LayoutList, Activity, AlertTriangle, ArrowUp, ArrowDown, Minus, Cloud, Blocks, Gauge, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequirementVersions } from "./RequirementVersions";

const CLOUD_LABELS: Record<string, string> = {
  sales_cloud: "Sales Cloud",
  service_cloud: "Service Cloud",
  experience_cloud: "Experience Cloud",
  marketing_cloud: "Marketing Cloud",
  commerce_cloud: "Commerce Cloud",
  analytics_cloud: "Analytics Cloud",
  platform: "Platform",
  other: "Other",
};

const COMPONENT_LABELS: Record<string, string> = {
  apex_class: "Apex Class",
  apex_trigger: "Apex Trigger",
  lwc: "Lightning Web Component",
  aura: "Aura Component",
  flow: "Flow",
  validation_rule: "Validation Rule",
  custom_object: "Custom Object",
  custom_field: "Custom Field",
  integration: "Integration",
  report_dashboard: "Report / Dashboard",
  permission_set: "Permission Set",
  other: "Other",
};

const EFFORT_LABELS: Record<string, string> = {
  xs: "XS — Trivial",
  s: "S — Small",
  m: "M — Medium",
  l: "L — Large",
  xl: "XL — Epic",
};

const priorityConfig: Record<string, { icon: React.ElementType; class: string }> = {
  critical: { icon: AlertTriangle, class: "text-status-failed" },
  high: { icon: ArrowUp, class: "text-status-in-progress" },
  medium: { icon: Minus, class: "text-primary" },
  low: { icon: ArrowDown, class: "text-muted-foreground" },
};

interface DbRequirement {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  sf_cloud: string | null;
  component_type: string | null;
  module_name: string | null;
  effort_estimate: string | null;
  workflow_status: string;
  created_at: string;
  updated_at: string;
  depends_on: string[] | null;
}

interface Props {
  requirement: Requirement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (agentId: string, status: AgentStatus) => void;
  onUpdated: () => void;
}

export function RequirementDetailDialog({ requirement, open, onOpenChange, onStatusChange, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbReq, setDbReq] = useState<DbRequirement | null>(null);
  const { toast } = useToast();

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editCloud, setEditCloud] = useState("");
  const [editComponent, setEditComponent] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editEffort, setEditEffort] = useState("");

  const fetchDetails = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("requirements")
      .select("*")
      .eq("id", requirement.id)
      .single();
    if (data) {
      const d = data as any as DbRequirement;
      setDbReq(d);
      setEditTitle(d.title);
      setEditDesc(d.description || "");
      setEditPriority(d.priority);
      setEditCloud(d.sf_cloud || "");
      setEditComponent(d.component_type || "");
      setEditModule(d.module_name || "");
      setEditEffort(d.effort_estimate || "");
    }
    setLoading(false);
  };

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      fetchDetails();
      setEditing(false);
    }
  };

  const startEditing = () => {
    if (dbReq) {
      setEditTitle(dbReq.title);
      setEditDesc(dbReq.description || "");
      setEditPriority(dbReq.priority);
      setEditCloud(dbReq.sf_cloud || "");
      setEditComponent(dbReq.component_type || "");
      setEditModule(dbReq.module_name || "");
      setEditEffort(dbReq.effort_estimate || "");
    }
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("requirements")
      .update({
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        priority: editPriority as any,
        sf_cloud: editCloud || null,
        component_type: editComponent || null,
        module_name: editModule.trim() || null,
        effort_estimate: editEffort || null,
      } as any)
      .eq("id", requirement.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Requirement updated successfully" });
      setEditing(false);
      fetchDetails();
      onUpdated();
    }
    setSaving(false);
  };

  const PriorityIcon = priorityConfig[requirement.priority]?.icon || Minus;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-lg font-bold mb-2"
              />
            ) : (
              <h2 className="text-lg font-bold text-card-foreground">{dbReq?.title || requirement.title}</h2>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <WorkflowStatusBadge status={requirement.workflowStatus} />
              <span className={cn("inline-flex items-center gap-1 text-xs font-medium", priorityConfig[requirement.priority]?.class)}>
                <PriorityIcon className="h-3 w-3" />
                {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{requirement.createdAt}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={cancelEditing} className="gap-1 text-xs">
                  <X className="h-3 w-3" />Cancel
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={saving || !editTitle.trim()} className="gap-1 text-xs">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEditing} className="gap-1 text-xs">
                <Pencil className="h-3 w-3" />Edit
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="bg-secondary/30 border border-border p-0.5">
                <TabsTrigger value="details" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <LayoutList className="h-3 w-3" />Details
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Activity className="h-3 w-3" />Agent Pipeline
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Layers className="h-3 w-3" />Version History
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="mt-4 space-y-5">
                {/* Description */}
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Description</label>
                  {editing ? (
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="mt-1.5"
                      placeholder="Requirement description..."
                    />
                  ) : (
                    <p className="text-sm text-card-foreground mt-1.5 leading-relaxed">
                      {dbReq?.description || requirement.description || "No description provided."}
                    </p>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Priority */}
                  <div className="rounded-lg bg-secondary/20 px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Priority</p>
                    {editing ? (
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className={cn("text-sm font-medium capitalize", priorityConfig[dbReq?.priority || requirement.priority]?.class)}>
                        {dbReq?.priority || requirement.priority}
                      </p>
                    )}
                  </div>

                  {/* SF Cloud */}
                  <div className="rounded-lg bg-secondary/20 px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Cloud className="h-3 w-3" />Salesforce Cloud
                    </p>
                    {editing ? (
                      <Select value={editCloud} onValueChange={setEditCloud}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select cloud" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales_cloud">Sales Cloud</SelectItem>
                          <SelectItem value="service_cloud">Service Cloud</SelectItem>
                          <SelectItem value="experience_cloud">Experience Cloud</SelectItem>
                          <SelectItem value="marketing_cloud">Marketing Cloud</SelectItem>
                          <SelectItem value="commerce_cloud">Commerce Cloud</SelectItem>
                          <SelectItem value="analytics_cloud">Analytics Cloud</SelectItem>
                          <SelectItem value="platform">Platform</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium text-card-foreground">
                        {CLOUD_LABELS[dbReq?.sf_cloud || ""] || "—"}
                      </p>
                    )}
                  </div>

                  {/* Component Type */}
                  <div className="rounded-lg bg-secondary/20 px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Blocks className="h-3 w-3" />Component Type
                    </p>
                    {editing ? (
                      <Select value={editComponent} onValueChange={setEditComponent}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="apex_class">Apex Class</SelectItem>
                          <SelectItem value="apex_trigger">Apex Trigger</SelectItem>
                          <SelectItem value="lwc">Lightning Web Component</SelectItem>
                          <SelectItem value="aura">Aura Component</SelectItem>
                          <SelectItem value="flow">Flow</SelectItem>
                          <SelectItem value="validation_rule">Validation Rule</SelectItem>
                          <SelectItem value="custom_object">Custom Object</SelectItem>
                          <SelectItem value="custom_field">Custom Field</SelectItem>
                          <SelectItem value="integration">Integration</SelectItem>
                          <SelectItem value="report_dashboard">Report / Dashboard</SelectItem>
                          <SelectItem value="permission_set">Permission Set</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium text-card-foreground">
                        {COMPONENT_LABELS[dbReq?.component_type || ""] || "—"}
                      </p>
                    )}
                  </div>

                  {/* Effort Estimate */}
                  <div className="rounded-lg bg-secondary/20 px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Gauge className="h-3 w-3" />Effort Estimate
                    </p>
                    {editing ? (
                      <Select value={editEffort} onValueChange={setEditEffort}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="T-shirt size" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xs">XS — Trivial</SelectItem>
                          <SelectItem value="s">S — Small</SelectItem>
                          <SelectItem value="m">M — Medium</SelectItem>
                          <SelectItem value="l">L — Large</SelectItem>
                          <SelectItem value="xl">XL — Epic</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium text-card-foreground">
                        {EFFORT_LABELS[dbReq?.effort_estimate || ""] || "—"}
                      </p>
                    )}
                  </div>

                  {/* Module */}
                  <div className="rounded-lg bg-secondary/20 px-4 py-3 col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Module / Feature Area</p>
                    {editing ? (
                      <Input
                        value={editModule}
                        onChange={(e) => setEditModule(e.target.value)}
                        placeholder="e.g. Opportunity Management, Case Routing"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <p className="text-sm font-medium text-card-foreground">
                        {dbReq?.module_name || "—"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t border-border">
                  <span>Created: {dbReq?.created_at ? new Date(dbReq.created_at).toLocaleString() : requirement.createdAt}</span>
                  {dbReq?.updated_at && <span>Updated: {new Date(dbReq.updated_at).toLocaleString()}</span>}
                </div>
              </TabsContent>

              {/* Pipeline Tab */}
              <TabsContent value="pipeline" className="mt-4">
                <AgentPipeline
                  agents={requirement.agents}
                  requirementId={requirement.id}
                  onStatusChange={onStatusChange}
                />
              </TabsContent>

              {/* Version History Tab */}
              <TabsContent value="history" className="mt-4">
                <RequirementVersions requirementId={requirement.id} requirementTitle={dbReq?.title || requirement.title} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
