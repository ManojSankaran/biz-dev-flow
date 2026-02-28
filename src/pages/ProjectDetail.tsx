import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequirementCard } from "@/components/RequirementCard";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { SearchFilterBar, PriorityFilter, StatusFilter, SortOption } from "@/components/SearchFilterBar";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Activity, ArrowLeft, Users, FileUp, LayoutList, BarChart3, Plus, Loader2, Trash2,
  Upload, File, Image, FileText, Sparkles, UserPlus, GitBranch, Save, Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Requirement, AgentInfo, AgentStatus, AGENT_TEMPLATES, WorkflowStatus } from "@/types/requirement";

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const AGENT_ORDER = new Map(AGENT_TEMPLATES.map((agent, index) => [agent.name, index]));

function getOverallStatus(agents: { status: AgentStatus }[]): AgentStatus {
  if (agents.some((a) => a.status === "failed")) return "failed";
  if (agents.every((a) => a.status === "completed")) return "completed";
  if (agents.some((a) => a.status === "in-progress")) return "in-progress";
  return "pending";
}

interface Stakeholder {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

interface Artifact {
  id: string;
  name: string;
  file_type: string | null;
  storage_path: string;
  uploaded_at: string;
}

interface DevOpsConfig {
  id?: string;
  provider: string;
  repo_url: string;
  branch: string;
  auth_token: string;
  username: string;
  project_structure: string;
}

interface DbRequirement {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  created_at: string;
  workflow_status: string;
}

interface DbAgent {
  id: string;
  requirement_id: string;
  agent_name: string;
  agent_role: string;
  agent_icon: string;
  status: string;
}

const EMPTY_DEVOPS: DevOpsConfig = {
  provider: "github",
  repo_url: "",
  branch: "main",
  auth_token: "",
  username: "",
  project_structure: "sfdx",
};

const ProjectDetail = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<{ title: string; description: string | null } | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);

  // DevOps config
  const [devopsConfig, setDevopsConfig] = useState<DevOpsConfig>(EMPTY_DEVOPS);
  const [devopsEditing, setDevopsEditing] = useState(false);
  const [devopsSaving, setDevopsSaving] = useState(false);
  const [devopsExists, setDevopsExists] = useState(false);

  // Stakeholder form
  const [shDialogOpen, setShDialogOpen] = useState(false);
  const [shName, setShName] = useState("");
  const [shRole, setShRole] = useState("");
  const [shEmail, setShEmail] = useState("");

  // Requirement form
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqPriority, setReqPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  // AI
  const [generating, setGenerating] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    const [projRes, shRes, artRes, reqRes, devopsRes] = await Promise.all([
      supabase.from("projects").select("title, description").eq("id", projectId).single(),
      supabase.from("project_stakeholders").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("project_artifacts").select("*").eq("project_id", projectId).order("uploaded_at", { ascending: false }),
      supabase.from("requirements").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("project_devops_config" as any).select("*").eq("project_id", projectId).maybeSingle(),
    ]);

    if (projRes.data) setProject(projRes.data);
    if (shRes.data) setStakeholders(shRes.data as Stakeholder[]);
    if (artRes.data) setArtifacts(artRes.data as Artifact[]);

    if (devopsRes.data) {
      const d = devopsRes.data as any;
      setDevopsConfig({
        id: d.id,
        provider: d.provider || "github",
        repo_url: d.repo_url || "",
        branch: d.branch || "main",
        auth_token: d.auth_token || "",
        username: d.username || "",
        project_structure: d.project_structure || "sfdx",
      });
      setDevopsExists(true);
      setDevopsEditing(false);
    } else {
      setDevopsConfig(EMPTY_DEVOPS);
      setDevopsExists(false);
      setDevopsEditing(true);
    }

    if (reqRes.data && reqRes.data.length > 0) {
      const reqIds = (reqRes.data as DbRequirement[]).map((r) => r.id);
      const { data: agentsData } = await supabase
        .from("requirement_agents")
        .select("*")
        .in("requirement_id", reqIds);

      const agentsByReq = new Map<string, DbAgent[]>();
      (agentsData as DbAgent[] || []).forEach((a) => {
        const list = agentsByReq.get(a.requirement_id) || [];
        list.push(a);
        agentsByReq.set(a.requirement_id, list);
      });

      const reqs: Requirement[] = (reqRes.data as DbRequirement[]).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description || "",
        priority: r.priority as Requirement["priority"],
        createdAt: r.created_at.split("T")[0],
        workflowStatus: (r.workflow_status || "pending_ba_approval") as WorkflowStatus,
        agents: (agentsByReq.get(r.id) || [])
          .slice()
          .sort((a, b) => {
            const aOrder = AGENT_ORDER.get(a.agent_name) ?? Number.MAX_SAFE_INTEGER;
            const bOrder = AGENT_ORDER.get(b.agent_name) ?? Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder;
          })
          .map((a) => ({
            id: a.id,
            name: a.agent_name,
            role: a.agent_role,
            icon: a.agent_icon,
            status: a.status as AgentStatus,
          })),
      }));
      setRequirements(reqs);
    } else {
      setRequirements([]);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- DevOps config save ---
  const saveDevopsConfig = async () => {
    if (!projectId || !devopsConfig.repo_url.trim()) {
      toast({ title: "Error", description: "Repository URL is required", variant: "destructive" });
      return;
    }
    setDevopsSaving(true);
    const payload = {
      project_id: projectId,
      provider: devopsConfig.provider,
      repo_url: devopsConfig.repo_url.trim(),
      branch: devopsConfig.branch.trim() || "main",
      auth_token: devopsConfig.auth_token.trim() || null,
      username: devopsConfig.username.trim() || null,
      project_structure: devopsConfig.project_structure,
    };

    let error;
    if (devopsExists && devopsConfig.id) {
      ({ error } = await supabase.from("project_devops_config" as any).update(payload).eq("id", devopsConfig.id));
    } else {
      ({ error } = await supabase.from("project_devops_config" as any).insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "DevOps configuration saved successfully" });
      setDevopsEditing(false);
      fetchAll();
    }
    setDevopsSaving(false);
  };

  const deleteDevopsConfig = async () => {
    if (!devopsConfig.id) return;
    await supabase.from("project_devops_config" as any).delete().eq("id", devopsConfig.id);
    setDevopsConfig(EMPTY_DEVOPS);
    setDevopsExists(false);
    setDevopsEditing(true);
    toast({ title: "Deleted", description: "DevOps configuration removed" });
  };

  const addStakeholder = async () => {
    if (!shName.trim() || !projectId) return;
    const { error } = await supabase.from("project_stakeholders").insert({
      project_id: projectId,
      name: shName.trim(),
      role: shRole.trim() || null,
      email: shEmail.trim() || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setShDialogOpen(false);
    setShName(""); setShRole(""); setShEmail("");
    fetchAll();
  };

  const deleteStakeholder = async (id: string) => {
    await supabase.from("project_stakeholders").delete().eq("id", id);
    setStakeholders((s) => s.filter((sh) => sh.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !projectId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("project-artifacts").upload(path, file);
      if (uploadErr) { toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" }); continue; }
      await supabase.from("project_artifacts").insert({
        project_id: projectId,
        name: file.name,
        file_type: file.type,
        storage_path: path,
      });
    }
    setUploading(false);
    fetchAll();
    e.target.value = "";
  };

  const deleteArtifact = async (artifact: Artifact) => {
    await supabase.storage.from("project-artifacts").remove([artifact.storage_path]);
    await supabase.from("project_artifacts").delete().eq("id", artifact.id);
    setArtifacts((a) => a.filter((ar) => ar.id !== artifact.id));
  };

  const addRequirement = async () => {
    if (!reqTitle.trim() || !projectId) return;
    const { data: reqData, error } = await supabase
      .from("requirements")
      .insert({ project_id: projectId, title: reqTitle.trim(), description: reqDesc.trim() || null, priority: reqPriority })
      .select()
      .single();
    if (error || !reqData) { toast({ title: "Error", description: error?.message, variant: "destructive" }); return; }

    const agentInserts = AGENT_TEMPLATES.map((t) => ({
      requirement_id: reqData.id,
      agent_name: t.name,
      agent_role: t.role,
      agent_icon: t.icon,
      status: "pending" as const,
    }));
    await supabase.from("requirement_agents").insert(agentInserts);

    setReqDialogOpen(false);
    setReqTitle(""); setReqDesc(""); setReqPriority("medium");
    fetchAll();
  };

  const updateAgentStatus = async (agentId: string, status: AgentStatus) => {
    await supabase.from("requirement_agents").update({ status }).eq("id", agentId);
    setRequirements((prev) =>
      prev.map((r) => ({
        ...r,
        agents: r.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
      }))
    );
  };

  const deleteRequirement = async (reqId: string) => {
    await supabase.from("requirements").delete().eq("id", reqId);
    setRequirements((prev) => prev.filter((r) => r.id !== reqId));
  };

  const generateRequirements = async () => {
    if (!projectId || artifacts.length === 0) {
      toast({ title: "No artifacts", description: "Upload documents or transcripts first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-requirements", {
        body: { projectId },
      });
      if (error) throw error;
      toast({ title: "Requirements generated", description: `${data?.count || 0} requirements created from your artifacts` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message || "Failed to generate requirements", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Filtering
  const filteredRequirements = (() => {
    let result = requirements;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    if (priorityFilter !== "all") result = result.filter((r) => r.priority === priorityFilter);
    if (statusFilter !== "all") result = result.filter((r) => getOverallStatus(r.agents) === statusFilter);

    const sorted = [...result];
    switch (sort) {
      case "newest": sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case "oldest": sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
      case "priority": sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]); break;
      case "progress": sorted.sort((a, b) => {
        const pa = a.agents.filter((ag) => ag.status === "completed").length / (a.agents.length || 1);
        const pb = b.agents.filter((ag) => ag.status === "completed").length / (b.agents.length || 1);
        return pb - pa;
      }); break;
    }
    return sorted;
  })();

  const fileIcon = (type: string | null) => {
    if (type?.startsWith("image")) return <Image className="h-4 w-4 text-primary" />;
    if (type?.includes("pdf")) return <FileText className="h-4 w-4 text-status-failed" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const providerLabel = (p: string) => {
    const map: Record<string, string> = { github: "GitHub", gitlab: "GitLab", bitbucket: "Bitbucket", azure_devops: "Azure DevOps" };
    return map[p] || p;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 glass sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-card-foreground">{project?.title}</h1>
              {project?.description && <p className="text-[10px] text-muted-foreground truncate max-w-xs">{project.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              onClick={generateRequirements}
              disabled={generating || artifacts.length === 0}
              className="gap-2"
              variant="outline"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Generate
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="stakeholders" className="space-y-4">
          <TabsList className="bg-secondary/30 border border-border p-0.5">
            <TabsTrigger value="stakeholders" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Users className="h-3.5 w-3.5" />Stakeholders
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <FileUp className="h-3.5 w-3.5" />Artifacts
              {artifacts.length > 0 && <span className="ml-1 h-4 min-w-4 rounded-full bg-primary/20 text-primary text-[10px] font-mono flex items-center justify-center px-1">{artifacts.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="devops" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <GitBranch className="h-3.5 w-3.5" />DevOps Config
            </TabsTrigger>
            <TabsTrigger value="requirements" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <LayoutList className="h-3.5 w-3.5" />Requirements
              {requirements.length > 0 && <span className="ml-1 h-4 min-w-4 rounded-full bg-primary/20 text-primary text-[10px] font-mono flex items-center justify-center px-1">{requirements.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <BarChart3 className="h-3.5 w-3.5" />Analytics
            </TabsTrigger>
          </TabsList>

          {/* Stakeholders Tab */}
          <TabsContent value="stakeholders" className="mt-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Stakeholders</h3>
                <Dialog open={shDialogOpen} onOpenChange={setShDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Add</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Add Stakeholder</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-3 pt-2">
                      <Input placeholder="Name *" value={shName} onChange={(e) => setShName(e.target.value)} />
                      <Input placeholder="Role / Designation" value={shRole} onChange={(e) => setShRole(e.target.value)} />
                      <Input placeholder="Email" type="email" value={shEmail} onChange={(e) => setShEmail(e.target.value)} />
                      <Button onClick={addStakeholder} disabled={!shName.trim()}>Add Stakeholder</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {stakeholders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No stakeholders yet. Add your project team members.</p>
              ) : (
                <div className="space-y-2">
                  {stakeholders.map((sh) => (
                    <div key={sh.id} className="flex items-center justify-between rounded-lg bg-secondary/20 px-4 py-3 group">
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{sh.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {sh.role && <span className="text-xs text-primary font-mono">{sh.role}</span>}
                          {sh.email && <span className="text-xs text-muted-foreground">{sh.email}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteStakeholder(sh.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Artifacts Tab */}
          <TabsContent value="artifacts" className="mt-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Project Artifacts</h3>
                <label className="cursor-pointer">
                  <Button size="sm" className="gap-1.5 pointer-events-none" asChild>
                    <span>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload
                    </span>
                  </Button>
                  <input type="file" className="hidden" multiple onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Upload meeting transcripts, images, and documents. Then use AI Generate to extract requirements.</p>
              {artifacts.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <FileUp className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No artifacts uploaded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {artifacts.map((art) => (
                    <div key={art.id} className="flex items-center justify-between rounded-lg bg-secondary/20 px-4 py-3 group">
                      <div className="flex items-center gap-3">
                        {fileIcon(art.file_type)}
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{art.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{new Date(art.uploaded_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteArtifact(art)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* DevOps Config Tab */}
          <TabsContent value="devops" className="mt-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">DevOps Configuration</h3>
                  <p className="text-xs text-muted-foreground mt-1">Configure repository credentials for automated deployment by the DevOps agent.</p>
                </div>
                {devopsExists && !devopsEditing && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDevopsEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive gap-1.5" onClick={deleteDevopsConfig}>
                      <Trash2 className="h-3.5 w-3.5" />Remove
                    </Button>
                  </div>
                )}
              </div>

              {!devopsEditing && devopsExists ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-secondary/20 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Provider</p>
                      <p className="text-sm font-medium text-card-foreground">{providerLabel(devopsConfig.provider)}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/20 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Branch</p>
                      <p className="text-sm font-medium text-card-foreground font-mono">{devopsConfig.branch}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/20 px-4 py-3 col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Repository URL</p>
                      <p className="text-sm font-medium text-card-foreground font-mono truncate">{devopsConfig.repo_url}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/20 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Username</p>
                      <p className="text-sm font-medium text-card-foreground">{devopsConfig.username || "—"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/20 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Project Structure</p>
                      <p className="text-sm font-medium text-card-foreground">{devopsConfig.project_structure === "sfdx" ? "SFDX (force-app/)" : devopsConfig.project_structure === "mdapi" ? "MDAPI (src/)" : "Auto-detect"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/20 px-4 py-3 col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Auth Token</p>
                      <p className="text-sm font-medium text-card-foreground font-mono">{"•".repeat(12)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Provider *</label>
                      <Select value={devopsConfig.provider} onValueChange={(v) => setDevopsConfig((c) => ({ ...c, provider: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github">GitHub</SelectItem>
                          <SelectItem value="gitlab">GitLab</SelectItem>
                          <SelectItem value="bitbucket">Bitbucket</SelectItem>
                          <SelectItem value="azure_devops">Azure DevOps</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Branch</label>
                      <Input placeholder="main" value={devopsConfig.branch} onChange={(e) => setDevopsConfig((c) => ({ ...c, branch: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Repository URL *</label>
                    <Input placeholder="https://github.com/org/repo.git" value={devopsConfig.repo_url} onChange={(e) => setDevopsConfig((c) => ({ ...c, repo_url: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Username</label>
                      <Input placeholder="Username / Service Account" value={devopsConfig.username} onChange={(e) => setDevopsConfig((c) => ({ ...c, username: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Auth Token / PAT</label>
                      <Input type="password" placeholder="Personal Access Token" value={devopsConfig.auth_token} onChange={(e) => setDevopsConfig((c) => ({ ...c, auth_token: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Salesforce Project Structure</label>
                    <Select value={devopsConfig.project_structure} onValueChange={(v) => setDevopsConfig((c) => ({ ...c, project_structure: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sfdx">SFDX — force-app/main/default/</SelectItem>
                        <SelectItem value="mdapi">MDAPI — src/</SelectItem>
                        <SelectItem value="auto">Auto-detect from repository</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveDevopsConfig} disabled={devopsSaving || !devopsConfig.repo_url.trim()} className="gap-1.5">
                      {devopsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {devopsExists ? "Update" : "Save"} Configuration
                    </Button>
                    {devopsExists && (
                      <Button variant="ghost" onClick={() => { setDevopsEditing(false); fetchAll(); }}>Cancel</Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Requirements Tab */}
          <TabsContent value="requirements" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <SearchFilterBar
                search={search} onSearchChange={setSearch}
                priority={priorityFilter} onPriorityChange={setPriorityFilter}
                status={statusFilter} onStatusChange={setStatusFilter}
                sort={sort} onSortChange={setSort}
              />
              <Dialog open={reqDialogOpen} onOpenChange={setReqDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 ml-3 flex-shrink-0"><Plus className="h-4 w-4" />Add</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>New Requirement</DialogTitle></DialogHeader>
                  <div className="flex flex-col gap-4 pt-2">
                    <Input placeholder="Requirement title" value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} />
                    <Textarea placeholder="Description..." value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={3} />
                    <Select value={reqPriority} onValueChange={(v) => setReqPriority(v as any)}>
                      <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addRequirement} disabled={!reqTitle.trim()}>Create Requirement</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredRequirements.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <p className="text-sm">No requirements yet. Add manually or use AI Generate.</p>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredRequirements.map((req) => (
                    <RequirementCard
                      key={req.id}
                      requirement={req}
                      onStatusChange={(agentId, status) => updateAgentStatus(agentId, status)}
                      onAutoProgress={() => {}}
                      onDelete={() => deleteRequirement(req.id)}
                      onApproval={fetchAll}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <AnalyticsDashboard requirements={requirements} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProjectDetail;
