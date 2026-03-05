import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { requirementId, agentName, currentContent, chatHistory } = await req.json();
    if (!requirementId || !agentName) throw new Error("requirementId and agentName required");

    // Verify access
    const { data: req_data } = await supabase
      .from("requirements")
      .select("id, title, description, project_id, sf_cloud, component_type, module_name")
      .eq("id", requirementId)
      .single();
    if (!req_data) throw new Error("Requirement not found");

    const { data: project } = await supabase
      .from("projects")
      .select("title, owner_id")
      .eq("id", req_data.project_id)
      .eq("owner_id", user.id)
      .single();
    if (!project) throw new Error("Access denied");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isBA = agentName === "Business Analyst";
    const systemPrompt = isBA
      ? `You are a senior Salesforce Business Analyst helping refine user stories and requirements. The current requirement is:
Title: ${req_data.title}
Description: ${req_data.description || "N/A"}
SF Cloud: ${req_data.sf_cloud || "N/A"}
Component: ${req_data.component_type || "N/A"}
Module: ${req_data.module_name || "N/A"}

The current user story/BA analysis document is provided. Help the user enhance, refine, or modify it based on their feedback. 
When providing an updated document, format it in clean markdown with user stories, acceptance criteria, business rules, and Salesforce-specific considerations.
Always respond conversationally first, then if changes are needed, provide the FULL updated document wrapped in <updated_document> tags.`
      : `You are a senior Salesforce Technical Architect helping refine technical designs. The current requirement is:
Title: ${req_data.title}
Description: ${req_data.description || "N/A"}
SF Cloud: ${req_data.sf_cloud || "N/A"}
Component: ${req_data.component_type || "N/A"}
Module: ${req_data.module_name || "N/A"}

The current technical design document is provided. Help the user enhance, refine, or modify it based on their feedback.
When providing an updated document, format it in clean markdown with architecture decisions, component designs, data model changes, and implementation approach.
Always respond conversationally first, then if changes are needed, provide the FULL updated document wrapped in <updated_document> tags.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the current document:\n\n${currentContent}` },
    ];

    // Add chat history
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI processing failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("enhance-output error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
