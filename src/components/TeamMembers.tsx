import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Trash2, Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  display_name?: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  project_manager: "bg-primary/10 text-primary border-primary/20",
  business_analyst: "bg-accent/50 text-accent-foreground border-accent",
  architect: "bg-secondary text-secondary-foreground border-border",
  developer: "bg-primary/10 text-primary border-primary/20",
  viewer: "bg-muted text-muted-foreground border-border",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  business_analyst: "Business Analyst",
  architect: "Architect",
  developer: "Developer",
  viewer: "Viewer",
};

interface TeamMembersProps {
  projectId: string;
  isOwner: boolean;
}

export function TeamMembers({ projectId, isOwner }: TeamMembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("project_members" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");
    
    if (data) {
      // Fetch display names for members
      const userIds = (data as any[]).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("auth_id, display_name")
        .in("auth_id", userIds);
      
      const nameMap = new Map((profiles || []).map((p) => [p.auth_id, p.display_name]));
      setMembers((data as any[]).map((m: any) => ({
        ...m,
        display_name: nameMap.get(m.user_id) || "Unknown User",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [projectId]);

  const addMember = async () => {
    if (!email.trim()) return;
    setAdding(true);

    // Look up user by email via profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("auth_id, display_name")
      .ilike("display_name", email.trim())
      .maybeSingle();

    if (!profile) {
      toast({ title: "User not found", description: "No user found with that email/name. They must sign up first.", variant: "destructive" });
      setAdding(false);
      return;
    }

    const { error } = await supabase
      .from("project_members" as any)
      .insert({ project_id: projectId, user_id: profile.auth_id, role });

    if (error) {
      toast({ title: "Error", description: error.message.includes("duplicate") ? "User is already a team member" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Member added", description: `${profile.display_name} added as ${ROLE_LABELS[role]}` });
      setDialogOpen(false);
      setEmail("");
      setRole("viewer");
      fetchMembers();
    }
    setAdding(false);
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("project_members" as any).delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast({ title: "Removed", description: "Team member removed" });
  };

  const updateRole = async (memberId: string, newRole: string) => {
    await supabase.from("project_members" as any).update({ role: newRole }).eq("id", memberId);
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
  };

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
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Team & Roles</h3>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary/30 px-1.5 py-0.5 rounded">{members.length}</span>
        </div>
        {isOwner && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Add Member</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                <Input placeholder="User display name or email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                    <SelectItem value="business_analyst">Business Analyst</SelectItem>
                    <SelectItem value="architect">Architect</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addMember} disabled={!email.trim() || adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No team members added yet.</p>
          <p className="text-xs mt-1">Add team members and assign roles for governance control.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-lg bg-secondary/20 px-4 py-3 group">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 h-8 w-8 flex items-center justify-center text-xs font-bold text-primary">
                  {(member.display_name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{member.display_name}</p>
                  <Badge variant="outline" className={`text-[10px] mt-0.5 ${ROLE_COLORS[member.role] || ""}`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </Badge>
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center gap-2">
                  <Select value={member.role} onValueChange={(v) => updateRole(member.id, v)}>
                    <SelectTrigger className="w-[130px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="business_analyst">Business Analyst</SelectItem>
                      <SelectItem value="architect">Architect</SelectItem>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeMember(member.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
