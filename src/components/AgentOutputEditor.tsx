import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Pencil, Eye, MessageSquare, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  requirementId: string;
  agentName: string;
  initialContent: string;
  outputLabel: string;
  onSaved?: () => void;
}

export function AgentOutputEditor({ requirementId, agentName, initialContent, outputLabel, onSaved }: Props) {
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [saving, setSaving] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if output exists
      const { data: existing } = await supabase
        .from("agent_outputs")
        .select("id")
        .eq("requirement_id", requirementId)
        .eq("agent_name", agentName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("agent_outputs")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_outputs")
          .insert({
            requirement_id: requirementId,
            agent_name: agentName,
            content,
            output_type: agentName === "Business Analyst" ? "requirements_analysis" : "technical_design",
          });
        if (error) throw error;
      }
      toast({ title: "Saved", description: `${outputLabel} updated successfully` });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || streaming) return;
    
    const userMsg: ChatMessage = { role: "user", content: msg };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput("");
    setStreaming(true);

    let assistantContent = "";
    
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enhance-output`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            requirementId,
            agentName,
            currentContent: content,
            chatHistory: newHistory,
          }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");
      
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setChatMessages([...newHistory, { role: "assistant", content: assistantContent }]);
            }
          } catch { /* partial */ }
        }
      }

      // Extract updated document if present
      const docMatch = assistantContent.match(/<updated_document>([\s\S]*?)<\/updated_document>/);
      if (docMatch) {
        setContent(docMatch[1].trim());
        toast({ title: "Document Updated", description: "The AI has updated the document. Review in the Edit tab and save when ready." });
      }
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
      setChatMessages([...newHistory, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setStreaming(false);
    }
  };

  const isEditable = agentName === "Business Analyst" || agentName === "Technical Architect";

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <TabsList className="bg-secondary/30 border border-border p-0.5">
            <TabsTrigger value="preview" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Eye className="h-3 w-3" />Preview
            </TabsTrigger>
            {isEditable && (
              <>
                <TabsTrigger value="edit" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Pencil className="h-3 w-3" />Edit
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Sparkles className="h-3 w-3" />AI Enhance
                </TabsTrigger>
              </>
            )}
          </TabsList>
          {isEditable && (
            <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          )}
        </div>

        <TabsContent value="preview" className="flex-1 mt-0">
          <ScrollArea className="h-[55vh]">
            <div className="prose prose-invert prose-sm max-w-none text-card-foreground text-sm leading-relaxed pr-4">
              <ReactMarkdown>{content || "No output available yet."}</ReactMarkdown>
            </div>
          </ScrollArea>
        </TabsContent>

        {isEditable && (
          <TabsContent value="edit" className="flex-1 mt-0">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-[55vh] font-mono text-xs bg-secondary/20 border-border resize-none"
              placeholder="Edit the document content in markdown..."
            />
          </TabsContent>
        )}

        {isEditable && (
          <TabsContent value="chat" className="flex-1 mt-0 flex flex-col">
            <ScrollArea className="flex-1 h-[45vh] border rounded-lg bg-secondary/10 p-3">
              <div className="space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>Ask AI to help enhance this {agentName === "Business Analyst" ? "user story" : "technical design"}.</p>
                    <p className="text-xs mt-1 opacity-70">Try: "Add more acceptance criteria" or "Include error handling scenarios"</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-card-foreground"
                    )}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content.replace(/<updated_document>[\s\S]*?<\/updated_document>/g, "\n\n✅ *Document has been updated. Check the Edit tab.*")}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {streaming && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-xl px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="flex gap-2 mt-3">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
                placeholder={`Ask AI to enhance the ${agentName === "Business Analyst" ? "user story" : "technical design"}...`}
                className="text-sm"
                disabled={streaming}
              />
              <Button size="icon" onClick={sendChatMessage} disabled={streaming || !chatInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
