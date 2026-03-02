import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Bot, User, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface ScopingHistoryProps {
  projectId: string;
  scopingStatus: string;
}

export function ScopingHistory({ projectId, scopingStatus }: ScopingHistoryProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("project_conversations" as any)
        .select("id, role, content, created_at")
        .eq("project_id", projectId)
        .neq("role", "system")
        .order("created_at", { ascending: true });
      setMessages((data as any) || []);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No scoping conversation recorded yet.</p>
        <p className="text-xs mt-1">Start a scoping session from the Scoping tab to see the conversation history here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-5 py-3 border-b">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">Scoping Conversation History</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary/30 px-1.5 py-0.5 rounded">{messages.length} messages</span>
        {scopingStatus === "completed" && (
          <span className="ml-auto text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Approved</span>
        )}
      </div>
      <ScrollArea className="h-[500px] px-5 py-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 rounded-full bg-primary/10 h-7 w-7 flex items-center justify-center mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={`rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/30 text-card-foreground"
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <p className={`text-[10px] mt-2 font-mono ${
                  msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                }`}>
                  {format(new Date(msg.created_at), "MMM d, HH:mm")}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 rounded-full bg-accent h-7 w-7 flex items-center justify-center mt-1">
                  <User className="h-3.5 w-3.5 text-accent-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
