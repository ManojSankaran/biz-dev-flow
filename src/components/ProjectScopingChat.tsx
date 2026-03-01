import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, CheckCircle2, Sparkles, MessageSquare, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ProjectScopingChatProps {
  projectId: string;
  scopingStatus: string;
  artifactCount: number;
  onScopingComplete: () => void;
}

export function ProjectScopingChat({ projectId, scopingStatus, artifactCount, onScopingComplete }: ProjectScopingChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [started, setStarted] = useState(scopingStatus !== "not_started");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load existing conversation
  useEffect(() => {
    if (scopingStatus === "not_started") return;
    (async () => {
      const { data } = await supabase
        .from("project_conversations" as any)
        .select("id, role, content, created_at")
        .eq("project_id", projectId)
        .neq("role", "system")
        .order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    })();
  }, [projectId, scopingStatus]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startScoping = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("project-scoping-chat", {
        body: { projectId, action: "start" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStarted(true);
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        created_at: new Date().toISOString(),
      }]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start scoping", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("project-scoping-chat", {
        body: { projectId, action: "chat", userMessage: msg },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        created_at: new Date().toISOString(),
      }]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send message", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const approveScoping = async () => {
    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke("project-scoping-chat", {
        body: { projectId, action: "approve" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Scoping Approved!",
        description: `${data.count} requirements have been automatically created.`,
      });
      onScopingComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to approve scoping", variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Not started yet - show Start Project button
  if (!started && scopingStatus === "not_started") {
    return (
      <div className="rounded-xl border bg-card p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground mb-2">Ready to Scope Your Project</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {artifactCount > 0
            ? `${artifactCount} artifact${artifactCount > 1 ? "s" : ""} uploaded. Start a conversation with AI to define your project scope. The AI will analyze your artifacts and present an initial scope for your review.`
            : "Upload artifacts first, then start the scoping conversation."}
        </p>
        <Button
          onClick={startScoping}
          disabled={starting || artifactCount === 0}
          size="lg"
          className="gap-2"
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          Start Project
        </Button>
      </div>
    );
  }

  // Completed
  if (scopingStatus === "completed") {
    return (
      <div className="rounded-xl border bg-card p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
        <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
        <h3 className="text-lg font-semibold text-card-foreground mb-1">Scoping Complete</h3>
        <p className="text-sm text-muted-foreground">Requirements have been generated. Check the Requirements tab.</p>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="rounded-xl border bg-card flex flex-col" style={{ height: "70vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary/10">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-card-foreground">Project Scoping Session</span>
        </div>
        <Button
          onClick={approveScoping}
          disabled={approving || messages.length < 2}
          size="sm"
          className="gap-1.5"
        >
          {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Approve & Generate Requirements
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4 max-w-3xl mx-auto">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 rounded-full bg-primary/10 h-7 w-7 flex items-center justify-center mt-1">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/30 text-card-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 rounded-full bg-accent h-7 w-7 flex items-center justify-center mt-1">
                    <User className="h-3.5 w-3.5 text-accent-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 rounded-full bg-primary/10 h-7 w-7 flex items-center justify-center mt-1">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-secondary/30 rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t bg-secondary/5">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your corrections, adjustments, or questions..."
            rows={2}
            className="resize-none text-sm"
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-auto self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-3xl mx-auto">
          Review the AI's analysis, correct any inaccuracies, then click "Approve & Generate Requirements" when satisfied.
        </p>
      </div>
    </div>
  );
}
