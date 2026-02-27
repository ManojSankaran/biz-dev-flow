import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Agent order: BA → Architect → Developer → Admin → QA → DevOps
// Order after Architect approval: Admin → Developer → QA → DevOps
const DOWNSTREAM_AGENTS = [
  { name: "Admin Agent", prompt: "Generate access control metadata and configuration", outputType: "metadata" },
  { name: "Developer Agent", prompt: "Generate implementation code", outputType: "code" },
  { name: "QA Agent", prompt: "Generate test cases and validation plan", outputType: "test_cases" },
  { name: "DevOps Agent", prompt: "Generate CI/CD pipeline and deployment configuration", outputType: "deployment" },
];

async function generateAgentOutput(
  supabase: any,
  requirementId: string,
  reqTitle: string,
  reqDescription: string,
  projectTitle: string,
  agentName: string,
  agentPromptHint: string,
  outputType: string,
  designContent: string,
  apiKey: string
) {
  const prompts: Record<string, string> = {
    "Developer Agent": `You are a Senior Developer. Based on the requirement and technical design below, generate implementation code.\n\nRequirement: ${reqTitle}\nDescription: ${reqDescription}\nProject: ${projectTitle}\n\nTechnical Design:\n${designContent}\n\nGenerate clean, well-documented implementation code covering:\n1. Core module/component code\n2. Data models/interfaces\n3. API endpoints or service methods\n4. Error handling\n5. Key algorithms\n\nFormat as markdown with code blocks.`,
    "Admin Agent": `You are an Admin/Config Agent. Based on the requirement and technical design below, generate access control and configuration metadata.\n\nRequirement: ${reqTitle}\nDescription: ${reqDescription}\nProject: ${projectTitle}\n\nTechnical Design:\n${designContent}\n\nGenerate:\n1. Required permissions and roles\n2. Environment variables and config\n3. Feature flags\n4. Access control rules\n5. Service accounts needed\n\nFormat as markdown.`,
    "QA Agent": `You are a QA Engineer. Based on the requirement and technical design below, generate comprehensive test cases.\n\nRequirement: ${reqTitle}\nDescription: ${reqDescription}\nProject: ${projectTitle}\n\nTechnical Design:\n${designContent}\n\nGenerate:\n1. Unit test cases\n2. Integration test scenarios\n3. Edge cases and boundary tests\n4. Performance test criteria\n5. Security test cases\n\nFormat as markdown with test tables.`,
    "DevOps Agent": `You are a DevOps Engineer. Based on the requirement and technical design below, generate deployment and CI/CD configuration.\n\nRequirement: ${reqTitle}\nDescription: ${reqDescription}\nProject: ${projectTitle}\n\nTechnical Design:\n${designContent}\n\nGenerate:\n1. CI/CD pipeline configuration\n2. Dockerfile or container config\n3. Infrastructure requirements\n4. Monitoring and alerting setup\n5. Rollback strategy\n\nFormat as markdown with config blocks.`,
  };

  const prompt = prompts[agentName] || `Generate output for ${agentName}: ${reqTitle}`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `You are a ${agentName}. Produce concise, actionable output.` },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiResponse.ok) return null;
  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || `${agentName} output generation failed.`;

  await supabase.from("agent_outputs").insert({
    requirement_id: requirementId,
    agent_name: agentName,
    content,
    output_type: outputType,
  });

  return content;
}

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

    const { requirementId, action } = await req.json();
    if (!requirementId || !action) throw new Error("requirementId and action required");
    if (!["approve", "reject"].includes(action)) throw new Error("action must be 'approve' or 'reject'");

    const { data: req_data, error: reqErr } = await supabase
      .from("requirements")
      .select("id, title, description, workflow_status, project_id")
      .eq("id", requirementId)
      .single();
    if (reqErr || !req_data) throw new Error("Requirement not found");

    const { data: project } = await supabase
      .from("projects")
      .select("id, owner_id, title")
      .eq("id", req_data.project_id)
      .eq("owner_id", user.id)
      .single();
    if (!project) throw new Error("Access denied");

    const currentStatus = req_data.workflow_status;

    if (action === "reject") {
      await supabase.from("notifications").insert({
        user_id: user.id,
        project_id: req_data.project_id,
        requirement_id: requirementId,
        type: "rejected",
        title: "Requirement rejected",
        message: `"${req_data.title}" was sent back for revision.`,
      });
      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // === BA APPROVAL ===
    if (currentStatus === "pending_ba_approval") {
      await supabase.from("requirements").update({ workflow_status: "generating_design" }).eq("id", requirementId);
      await supabase.from("requirement_agents").update({ status: "completed" }).eq("requirement_id", requirementId).eq("agent_name", "Business Analyst");

      // Generate Technical Design (Architect output)
      const designPrompt = `You are a Technical Architect. Generate a technical design document.\n\nRequirement: ${req_data.title}\nDescription: ${req_data.description || ""}\nProject: ${project.title}\n\nCreate a concise technical design covering:\n1. Architecture Overview\n2. Key Components/Services\n3. Data Model\n4. API Design\n5. Technology recommendations\n6. Security considerations\n\nFormat as clean markdown.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a senior technical architect." },
            { role: "user", content: designPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        await supabase.from("requirements").update({ workflow_status: "pending_ba_approval" }).eq("id", requirementId);
        await supabase.from("requirement_agents").update({ status: "in-progress" }).eq("requirement_id", requirementId).eq("agent_name", "Business Analyst");
        throw new Error("AI design generation failed");
      }

      const aiData = await aiResponse.json();
      const designContent = aiData.choices?.[0]?.message?.content || "Design generation failed.";

      // Save as technical_designs (legacy) AND agent_outputs
      await supabase.from("technical_designs").insert({ requirement_id: requirementId, content: designContent });
      await supabase.from("agent_outputs").insert({
        requirement_id: requirementId,
        agent_name: "Technical Architect",
        content: designContent,
        output_type: "technical_design",
      });

      await supabase.from("requirements").update({ workflow_status: "pending_architect_approval" }).eq("id", requirementId);
      await supabase.from("requirement_agents").update({ status: "in-progress" }).eq("requirement_id", requirementId).eq("agent_name", "Technical Architect");

      await supabase.from("notifications").insert({
        user_id: user.id,
        project_id: req_data.project_id,
        requirement_id: requirementId,
        type: "architect_approval_needed",
        title: "Technical design ready for review",
        message: `Technical design for "${req_data.title}" needs architect approval.`,
      });

      return new Response(JSON.stringify({ success: true, newStatus: "pending_architect_approval" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // === ARCHITECT APPROVAL ===
    } else if (currentStatus === "pending_architect_approval") {
      await supabase.from("requirements").update({ workflow_status: "in_development" }).eq("id", requirementId);
      await supabase.from("requirement_agents").update({ status: "completed" }).eq("requirement_id", requirementId).eq("agent_name", "Technical Architect");

      // Get the design content for downstream agents
      const { data: designData } = await supabase
        .from("agent_outputs")
        .select("content")
        .eq("requirement_id", requirementId)
        .eq("agent_name", "Technical Architect")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const designContent = designData?.content || "";

      // Generate all downstream agent outputs in parallel
      const promises = DOWNSTREAM_AGENTS.map(async (agent) => {
        await supabase.from("requirement_agents").update({ status: "in-progress" }).eq("requirement_id", requirementId).eq("agent_name", agent.name);
        
        const result = await generateAgentOutput(
          supabase, requirementId, req_data.title, req_data.description || "",
          project.title, agent.name, agent.prompt, agent.outputType, designContent, LOVABLE_API_KEY
        );

        await supabase.from("requirement_agents").update({ status: result ? "completed" : "failed" }).eq("requirement_id", requirementId).eq("agent_name", agent.name);
      });

      await Promise.all(promises);

      // Check if all completed
      const { data: allAgents } = await supabase
        .from("requirement_agents")
        .select("status")
        .eq("requirement_id", requirementId);
      const allDone = allAgents?.every((a: any) => a.status === "completed");
      
      if (allDone) {
        await supabase.from("requirements").update({ workflow_status: "completed" }).eq("id", requirementId);
      }

      await supabase.from("notifications").insert({
        user_id: user.id,
        project_id: req_data.project_id,
        requirement_id: requirementId,
        type: "approved",
        title: "Requirement approved for development",
        message: `"${req_data.title}" has been approved. All agents are processing.`,
      });

      return new Response(JSON.stringify({ success: true, newStatus: allDone ? "completed" : "in_development" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error(`Cannot approve requirement in status: ${currentStatus}`);
    }
  } catch (e) {
    console.error("approve-requirement error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
