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

    const { projectId, action, userMessage } = await req.json();
    if (!projectId) throw new Error("projectId required");

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, title, description, scoping_status")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();
    if (projErr || !project) throw new Error("Project not found or access denied");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // === START: Initialize scoping conversation ===
    if (action === "start") {
      // Read all artifacts
      const { data: artifacts } = await supabase
        .from("project_artifacts")
        .select("name, file_type, storage_path")
        .eq("project_id", projectId);

      let artifactContents = "";
      for (const art of (artifacts || [])) {
        if (art.file_type?.includes("text") || art.file_type?.includes("pdf") || art.name.endsWith(".txt") || art.name.endsWith(".md")) {
          const { data: fileData } = await supabase.storage.from("project-artifacts").download(art.storage_path);
          if (fileData) {
            const text = await fileData.text();
            artifactContents += `\n--- ${art.name} ---\n${text.slice(0, 8000)}\n`;
          }
        } else {
          artifactContents += `\n--- ${art.name} (${art.file_type || "unknown type"}) ---\n[Binary file - use file name for context]\n`;
        }
      }

      const { data: stakeholders } = await supabase
        .from("project_stakeholders")
        .select("name, role, email")
        .eq("project_id", projectId);

      const stakeholderInfo = (stakeholders || []).map((s: any) => `${s.name} (${s.role || "N/A"})`).join(", ");

      // Clear any previous conversation
      await supabase.from("project_conversations").delete().eq("project_id", projectId);

      // Update project scoping status
      await supabase.from("projects").update({ scoping_status: "in_progress" }).eq("id", projectId);

      const systemPrompt = `You are a Senior Salesforce Techno-Functional Consultant conducting a project scoping session. You have been given project artifacts to analyze.

Project: ${project.title}
Description: ${project.description || "N/A"}
Stakeholders: ${stakeholderInfo || "N/A"}

Project Artifacts:
${artifactContents || "No text artifacts available."}

Your role:
1. Analyze the provided artifacts thoroughly
2. Present a structured project scope covering:
   - Project Overview & Objectives
   - Key Stakeholders & Their Roles  
   - Functional Scope (what Salesforce features/modules are needed)
   - Non-Functional Requirements (performance, security, data volume)
   - Integration Points (external systems)
   - Data Migration Needs
   - Timeline & Phase Recommendations
   - Risks & Assumptions
   - Out of Scope Items
3. Ask clarifying questions about anything unclear in the artifacts
4. Accept corrections and adjustments from the techno-functional person
5. Keep the conversation focused and professional

Start by presenting your initial analysis of the project scope based on the artifacts. Be specific about Salesforce platform capabilities you recommend (Custom Objects, Apex, LWC, Flows, etc.)

IMPORTANT: Format your responses in clean markdown. Be thorough but concise.`;

      // Generate initial AI analysis
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Please analyze the project artifacts and present the initial project scope for my review." },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI analysis failed");
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content || "Failed to analyze artifacts.";

      // Store system context and initial messages
      await supabase.from("project_conversations").insert([
        { project_id: projectId, role: "system", content: systemPrompt },
        { project_id: projectId, role: "assistant", content: aiContent },
      ]);

      return new Response(JSON.stringify({ message: aiContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CHAT: Continue conversation ===
    if (action === "chat") {
      if (!userMessage?.trim()) throw new Error("userMessage required");

      // Store user message
      await supabase.from("project_conversations").insert({
        project_id: projectId, role: "user", content: userMessage.trim(),
      });

      // Fetch full conversation history
      const { data: history } = await supabase
        .from("project_conversations")
        .select("role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const messages = (history || []).map((m: any) => ({ role: m.role, content: m.content }));

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI response failed");
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

      // Store AI response
      await supabase.from("project_conversations").insert({
        project_id: projectId, role: "assistant", content: aiContent,
      });

      return new Response(JSON.stringify({ message: aiContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === APPROVE: Finalize scoping and generate requirements ===
    if (action === "approve") {
      // Fetch full conversation
      const { data: history } = await supabase
        .from("project_conversations")
        .select("role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .neq("role", "system");

      const conversationSummary = (history || [])
        .map((m: any) => `${m.role === "user" ? "Techno-Functional Person" : "AI Consultant"}: ${m.content}`)
        .join("\n\n---\n\n");

      // Fetch devops config
      const { data: devopsConfig } = await supabase
        .from("project_devops_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      const structureInfo = devopsConfig
        ? `Salesforce Project Structure: ${devopsConfig.project_structure === "sfdx" ? "SFDX (force-app/main/default/)" : devopsConfig.project_structure === "mdapi" ? "MDAPI (src/)" : "Auto-detect"}`
        : "";

      // Generate requirements from the approved conversation
      const extractionPrompt = `You are a Salesforce Business Analyst. Based on the following approved project scoping conversation, extract actionable Salesforce implementation requirements.

Project: ${project.title}
${structureInfo}

=== APPROVED SCOPING CONVERSATION ===
${conversationSummary}
=== END CONVERSATION ===

Extract 3-12 specific, actionable Salesforce requirements from this conversation. Each requirement should be a distinct deliverable. Consider:
- Custom Objects & Fields
- Apex Classes & Triggers
- Lightning Web Components
- Flows & Process Automation
- Permission Sets & Security
- Data Migration
- Integrations
- Reports & Dashboards

For each requirement include a detailed BA analysis with:
- User stories (As a [role], I want [feature], so that [benefit])
- Acceptance criteria with Salesforce-specific validations
- Business rules and automation logic
- Dependencies and risks`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a Salesforce Business Analyst. Extract structured requirements from an approved project scoping conversation." },
            { role: "user", content: extractionPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_requirements",
                description: "Extract Salesforce requirements from scoping conversation",
                parameters: {
                  type: "object",
                  properties: {
                    requirements: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                          ba_analysis: { type: "string" },
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
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Requirement extraction failed");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No requirements extracted");

      const extracted = JSON.parse(toolCall.function.arguments);
      const reqs = extracted.requirements || [];

      const AGENT_TEMPLATES = [
        { name: "Business Analyst", role: "Requirements Analysis", icon: "FileSearch" },
        { name: "Technical Architect", role: "System Design", icon: "Blocks" },
        { name: "Admin Agent", role: "Access & Config", icon: "Shield" },
        { name: "Developer Agent", role: "Implementation", icon: "Code" },
        { name: "QA Agent", role: "Testing & Validation", icon: "TestTube2" },
        { name: "DevOps Agent", role: "CI/CD & Deployment", icon: "GitBranch" },
      ];

      let count = 0;
      for (const r of reqs) {
        const { data: newReq, error: insertErr } = await supabase
          .from("requirements")
          .insert({
            project_id: projectId,
            title: r.title,
            description: r.description,
            priority: r.priority,
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
          content: r.ba_analysis || r.description,
          output_type: "requirements_analysis",
        });

        await supabase.from("notifications").insert({
          user_id: user.id,
          project_id: projectId,
          requirement_id: newReq.id,
          type: "ba_approval_needed",
          title: `Approval needed: ${r.title}`,
          message: `New requirement needs review before proceeding.`,
        });

        count++;
      }

      // Mark scoping as completed
      await supabase.from("projects").update({ scoping_status: "completed" }).eq("id", projectId);

      return new Response(JSON.stringify({ count, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("project-scoping-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
