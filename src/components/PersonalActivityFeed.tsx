import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CheckCircle2, AlertTriangle, Activity, ArrowRight,
  FileText, Shield, Zap, Loader2, Bell,
} from "lucide-react";
import { Button } from "./ui/button";

interface FeedItem {
  id: string;
  type: "audit" | "notification";
  title: string;
  message: string;
  projectId: string;
  projectTitle: string;
  timestamp: string;
  icon: "approval" | "requirement" | "scoping" | "agent" | "general";
  isRead?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  approval: Shield,
  requirement: FileText,
  scoping: Zap,
  agent: Activity,
  general: Bell,
};

const ICON_COLOR: Record<string, string> = {
  approval: "text-status-in-progress",
  requirement: "text-primary",
  scoping: "text-accent-foreground",
  agent: "text-status-completed",
  general: "text-muted-foreground",
};

function classifyAction(action: string): FeedItem["icon"] {
  if (action.includes("approv")) return "approval";
  if (action.includes("requirement") || action.includes("created") || action.includes("updated")) return "requirement";
  if (action.includes("scoping")) return "scoping";
  if (action.includes("agent") || action.includes("status")) return "agent";
  return "general";
}

export function PersonalActivityFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchFeed = async () => {
      // Fetch user's projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .eq("owner_id", user.id);

      if (!projects || projects.length === 0) {
        setLoading(false);
        return;
      }

      const projectMap = new Map(projects.map((p) => [p.id, p.title]));
      const projectIds = projects.map((p) => p.id);

      // Fetch recent audit logs and notifications in parallel
      const [auditRes, notifRes] = await Promise.all([
        supabase
          .from("audit_logs")
          .select("*")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const feedItems: FeedItem[] = [];

      if (auditRes.data) {
        for (const log of auditRes.data) {
          feedItems.push({
            id: `audit-${log.id}`,
            type: "audit",
            title: log.action.replace(/_/g, " "),
            message: `${log.entity_type}${log.entity_id ? "" : ""}`,
            projectId: log.project_id,
            projectTitle: projectMap.get(log.project_id) || "Unknown",
            timestamp: log.created_at,
            icon: classifyAction(log.action),
          });
        }
      }

      if (notifRes.data) {
        for (const n of notifRes.data) {
          feedItems.push({
            id: `notif-${n.id}`,
            type: "notification",
            title: n.title,
            message: n.message || "",
            projectId: n.project_id,
            projectTitle: projectMap.get(n.project_id) || "Unknown",
            timestamp: n.created_at,
            icon: classifyAction(n.type),
            isRead: n.is_read,
          });
        }
      }

      // Sort by timestamp descending
      feedItems.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setItems(feedItems.slice(0, 20));
      setLoading(false);
    };

    fetchFeed();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm font-medium">No recent activity</p>
        <p className="text-xs mt-1">Activity from your projects will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <AnimatePresence>
        {items.map((item, idx) => {
          const Icon = ICON_MAP[item.icon] || Activity;
          const iconColor = ICON_COLOR[item.icon] || "text-muted-foreground";
          const time = new Date(item.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - time.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          let timeLabel: string;
          if (diffMins < 1) timeLabel = "Just now";
          else if (diffMins < 60) timeLabel = `${diffMins}m ago`;
          else if (diffHours < 24) timeLabel = `${diffHours}h ago`;
          else if (diffDays < 7) timeLabel = `${diffDays}d ago`;
          else timeLabel = time.toLocaleDateString([], { month: "short", day: "numeric" });

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-secondary/20 transition-colors cursor-pointer group"
              onClick={() => navigate(`/project/${item.projectId}`)}
            >
              <div className={`h-7 w-7 rounded-lg bg-secondary/40 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-card-foreground capitalize truncate">{item.title}</span>
                  {item.type === "notification" && !item.isRead && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  <span className="text-primary/80 font-medium">{item.projectTitle}</span>
                  {item.message && <span> · {item.message}</span>}
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60 flex-shrink-0 mt-1">{timeLabel}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
