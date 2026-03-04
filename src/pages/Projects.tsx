import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, Plus, FolderOpen, Loader2, LogOut, Trash2, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalActivityFeed } from "@/components/PersonalActivityFeed";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

const Projects = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetGoLive, setTargetGoLive] = useState("");
  const [sfEdition, setSfEdition] = useState("");
  const [orgType, setOrgType] = useState("");
  const [sandboxUrl, setSandboxUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setProjects(data);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async () => {
    if (!title.trim() || !user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        owner_id: user.id,
        target_go_live: targetGoLive || null,
        salesforce_edition: sfEdition || null,
        org_type: orgType || null,
        sandbox_url: sandboxUrl.trim() || null,
      } as any)
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    setTitle("");
    setDescription("");
    if (data) navigate(`/project/${data.id}`);
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) setProjects((p) => p.filter((proj) => proj.id !== id));
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 glass sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center glow-sm">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">AgentFlow</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">Your Projects</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />New Project</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4 pt-2">
                  <Input placeholder="Project name" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  <Button onClick={createProject} disabled={!title.trim() || creating}>
                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList className="bg-secondary/30 border border-border p-0.5">
            <TabsTrigger value="projects" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <FolderOpen className="h-3.5 w-3.5" />Projects
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <History className="h-3.5 w-3.5" />Activity Feed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FolderOpen className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">No projects yet</p>
                <p className="text-sm mt-1">Create your first project to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {projects.map((project, idx) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="rounded-xl border bg-card p-5 cursor-pointer hover:glow-sm hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FolderOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-card-foreground">{project.title}</h3>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => deleteProject(project.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{project.description}</p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">Your Activity Feed</h3>
              <PersonalActivityFeed />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Projects;
