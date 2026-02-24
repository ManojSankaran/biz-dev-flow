import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_TEMPLATES = [
  { name: "Business Analyst", role: "Requirements Analysis", icon: "FileSearch" },
  { name: "Technical Architect", role: "System Design", icon: "Blocks" },
  { name: "Admin Agent", role: "Access & Config", icon: "Shield" },
  { name: "Developer Agent", role: "Implementation", icon: "Code" },
  { name: "QA Agent", role: "Testing & Validation", icon: "TestTube2" },
  { name: "DevOps Agent", role: "CI/CD & Deployment", icon: "GitBranch" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    // Verify ownership
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, title, description")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();
    if (projErr || !project) throw new Error("Project not found or access denied");

    // Get artifacts
    const { data: artifacts } = await supabase
      .from("project_artifacts")
      .select("name, file_type, storage_path")
      .eq("project_id", projectId);

    // Get stakeholders
    const { data: stakeholders } = await supabase
      .from("project_stakeholders")
      .select("name, role, email")
      .eq("project_id", projectId);

    // Download text content from artifacts
    let artifactContents = "";
    for (const art of (artifacts || [])) {
      if (art.file_type?.includes("text") || art.file_type?.includes("pdf") || art.name.endsWith(".txt") || art.name.endsWith(".md")) {
        const { data: fileData } = await supabase.storage.from("project-artifacts").download(art.storage_path);
        if (fileData) {
          const text = await fileData.text();
          artifactContents += `\n--- ${art.name} ---\n${text.slice(0, 5000)}\n`;
        }
      } else {
        artifactContents += `\n--- ${art.name} (${art.file_type || "unknown type"}) ---\n[Binary file - use file name for context]\n`;
      }
    }

    const stakeholderInfo = (stakeholders || []).map((s: any) => `${s.name} (${s.role || "N/A"})`).join(", ");

    const prompt = `You are a Business Analyst AI. Analyze the following project information and extract software requirements.

Project: ${project.title}
Description: ${project.description || "N/A"}
Stakeholders: ${stakeholderInfo || "N/A"}

Project Artifacts:
${artifactContents || "No text artifacts available. Generate requirements based on project title and description."}

Extract 3-8 actionable software requirements. Each requirement should have a clear title and description.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a Business Analyst. Extract software requirements from project artifacts." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_requirements",
              description: "Extract software requirements from project artifacts",
              parameters: {
                type: "object",
                properties: {
                  requirements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short requirement title" },
                        description: { type: "string", description: "Detailed requirement description" },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      },
                      required: ["title", "description", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["requirements"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_requirements" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI processing failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No requirements extracted from AI");

    const extracted = JSON.parse(toolCall.function.arguments);
    const reqs = extracted.requirements || [];

    let count = 0;
    for (const req of reqs) {
      const { data: newReq, error: insertErr } = await supabase
        .from("requirements")
        .insert({
          project_id: projectId,
          title: req.title,
          description: req.description,
          priority: req.priority,
        })
        .select()
        .single();

      if (insertErr || !newReq) continue;

      const agents = AGENT_TEMPLATES.map((t) => ({
        requirement_id: newReq.id,
        agent_name: t.name,
        agent_role: t.role,
        agent_icon: t.icon,
        status: "pending",
      }));

      await supabase.from("requirement_agents").insert(agents);
      count++;
    }

    return new Response(JSON.stringify({ count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-requirements error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
