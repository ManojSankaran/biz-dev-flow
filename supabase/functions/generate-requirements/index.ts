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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, title, description")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();
    if (projErr || !project) throw new Error("Project not found or access denied");

    const { data: artifacts } = await supabase
      .from("project_artifacts")
      .select("name, file_type, storage_path")
      .eq("project_id", projectId);

    const { data: stakeholders } = await supabase
      .from("project_stakeholders")
      .select("name, role, email")
      .eq("project_id", projectId);

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a Salesforce Business Analyst. Analyze the following project information and extract Salesforce-specific software requirements.

Project: ${project.title}
Description: ${project.description || "N/A"}
Stakeholders: ${stakeholderInfo || "N/A"}

Project Artifacts:
${artifactContents || "No text artifacts available. Generate requirements based on project title and description."}

Extract 3-8 actionable Salesforce implementation requirements. Each requirement should:
- Have a clear title describing the Salesforce feature/component
- Include a detailed description covering what needs to be built on the Salesforce platform
- Identify the Salesforce Cloud (sales_cloud, service_cloud, experience_cloud, marketing_cloud, commerce_cloud, analytics_cloud, platform, other)
- Identify the primary component type (apex_class, apex_trigger, lwc, aura, flow, validation_rule, custom_object, custom_field, integration, report_dashboard, permission_set, other)
- Identify the module or feature area (e.g. "Opportunity Management", "Case Routing", "Lead Scoring")
- Estimate effort using t-shirt sizing (xs, s, m, l, xl)
- Include a comprehensive BA analysis with:
  - User stories in the format "As a [role], I want [feature], so that [benefit]"
  - Acceptance criteria with specific Salesforce validations
  - Business rules including field validations, workflow rules, and automation logic
  - Salesforce-specific considerations (governor limits, sharing model, data volume)
  - Dependencies on existing Salesforce objects, packages, or integrations
  - Risks and assumptions`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a Salesforce Business Analyst. Extract Salesforce-specific software requirements from project artifacts. Focus on Salesforce platform capabilities: custom objects, Apex, LWC, flows, validation rules, permission sets, etc." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_requirements",
              description: "Extract Salesforce software requirements with detailed BA analysis",
              parameters: {
                type: "object",
                properties: {
                  requirements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short Salesforce requirement title" },
                        description: { type: "string", description: "Detailed Salesforce requirement description" },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        sf_cloud: { type: "string", enum: ["sales_cloud", "service_cloud", "experience_cloud", "marketing_cloud", "commerce_cloud", "analytics_cloud", "platform", "other"], description: "Primary Salesforce Cloud" },
                        component_type: { type: "string", enum: ["apex_class", "apex_trigger", "lwc", "aura", "flow", "validation_rule", "custom_object", "custom_field", "integration", "report_dashboard", "permission_set", "other"], description: "Primary component type" },
                        module_name: { type: "string", description: "Module or feature area, e.g. Opportunity Management" },
                        effort_estimate: { type: "string", enum: ["xs", "s", "m", "l", "xl"], description: "T-shirt size effort estimate" },
                        ba_analysis: { type: "string", description: "Detailed BA analysis in markdown: user stories, acceptance criteria, business rules, Salesforce-specific considerations, dependencies, risks, and assumptions" },
                      },
                      required: ["title", "description", "priority", "ba_analysis"],
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
      throw new Error("AI processing failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No requirements extracted from AI");

    const extracted = JSON.parse(toolCall.function.arguments);
    const reqs = extracted.requirements || [];

    const { data: baStakeholders } = await supabase
      .from("project_stakeholders")
      .select("name")
      .eq("project_id", projectId)
      .ilike("role", "%business analyst%");
    const baName = baStakeholders?.[0]?.name || "Business Analyst";

    let count = 0;
    for (const req of reqs) {
      const { data: newReq, error: insertErr } = await supabase
        .from("requirements")
        .insert({
          project_id: projectId,
          title: req.title,
          description: req.description,
          priority: req.priority,
          workflow_status: "pending_ba_approval",
        })
        .select()
        .single();

      if (insertErr || !newReq) continue;

      const agents = AGENT_TEMPLATES.map((t) => ({
        requirement_id: newReq.id,
        agent_name: t.name,
        agent_role: t.role,
        agent_icon: t.icon,
        status: t.name === "Business Analyst" ? "in-progress" : "pending",
      }));
      await supabase.from("requirement_agents").insert(agents);

      await supabase.from("agent_outputs").insert({
        requirement_id: newReq.id,
        agent_name: "Business Analyst",
        content: req.ba_analysis || req.description,
        output_type: "requirements_analysis",
      });

      await supabase.from("notifications").insert({
        user_id: user.id,
        project_id: projectId,
        requirement_id: newReq.id,
        type: "ba_approval_needed",
        title: `Approval needed: ${req.title}`,
        message: `New requirement needs ${baName}'s review before proceeding.`,
      });

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
