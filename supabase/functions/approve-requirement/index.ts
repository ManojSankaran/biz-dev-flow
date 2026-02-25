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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { requirementId, action } = await req.json();
    if (!requirementId || !action) throw new Error("requirementId and action required");
    if (!["approve", "reject"].includes(action)) throw new Error("action must be 'approve' or 'reject'");

    // Get requirement with project info
    const { data: req_data, error: reqErr } = await supabase
      .from("requirements")
      .select("id, title, workflow_status, project_id")
      .eq("id", requirementId)
      .single();
    if (reqErr || !req_data) throw new Error("Requirement not found");

    // Verify ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, owner_id, title")
      .eq("id", req_data.project_id)
      .eq("owner_id", user.id)
      .single();
    if (!project) throw new Error("Access denied");

    const currentStatus = req_data.workflow_status;

    if (action === "reject") {
      // For now, rejection just keeps it at current status with a notification
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

    // Handle approval based on current workflow status
    if (currentStatus === "pending_ba_approval") {
      // BA approved -> move to generating_design
      await supabase
        .from("requirements")
        .update({ workflow_status: "generating_design" })
        .eq("id", requirementId);

      // Trigger design generation
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const prompt = `You are a Technical Architect. Generate a technical design document for this requirement.\n\nRequirement: ${req_data.title}\nProject: ${project.title}\n\nCreate a concise technical design covering:\n1. Architecture Overview\n2. Key Components/Services\n3. Data Model considerations\n4. API Design\n5. Technology recommendations\n6. Security considerations\n\nFormat as clean markdown.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a senior technical architect. Produce concise, actionable technical designs." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        // Revert status if AI fails
        await supabase.from("requirements").update({ workflow_status: "pending_ba_approval" }).eq("id", requirementId);
        throw new Error("AI design generation failed");
      }

      const aiData = await aiResponse.json();
      const designContent = aiData.choices?.[0]?.message?.content || "Design generation failed.";

      // Save technical design
      await supabase.from("technical_designs").insert({
        requirement_id: requirementId,
        content: designContent,
      });

      // Update status to pending architect approval
      await supabase
        .from("requirements")
        .update({ workflow_status: "pending_architect_approval" })
        .eq("id", requirementId);

      // Find architect stakeholder and notify
      const { data: architects } = await supabase
        .from("project_stakeholders")
        .select("name")
        .eq("project_id", req_data.project_id)
        .ilike("role", "%architect%");

      const architectName = architects?.[0]?.name || "Technical Architect";

      await supabase.from("notifications").insert({
        user_id: user.id,
        project_id: req_data.project_id,
        requirement_id: requirementId,
        type: "architect_approval_needed",
        title: "Technical design ready for review",
        message: `Technical design for "${req_data.title}" needs ${architectName}'s approval.`,
      });

      // Update BA agent to completed, Architect to in-progress
      await supabase.from("requirement_agents").update({ status: "completed" }).eq("requirement_id", requirementId).eq("agent_name", "Business Analyst");
      await supabase.from("requirement_agents").update({ status: "in-progress" }).eq("requirement_id", requirementId).eq("agent_name", "Technical Architect");

      return new Response(JSON.stringify({ success: true, newStatus: "pending_architect_approval" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (currentStatus === "pending_architect_approval") {
      // Architect approved -> move to in_development
      await supabase
        .from("requirements")
        .update({ workflow_status: "in_development" })
        .eq("id", requirementId);

      // Update agent statuses
      await supabase.from("requirement_agents").update({ status: "completed" }).eq("requirement_id", requirementId).eq("agent_name", "Technical Architect");
      await supabase.from("requirement_agents").update({ status: "completed" }).eq("requirement_id", requirementId).eq("agent_name", "Admin Agent");
      await supabase.from("requirement_agents").update({ status: "in-progress" }).eq("requirement_id", requirementId).eq("agent_name", "Developer Agent");

      await supabase.from("notifications").insert({
        user_id: user.id,
        project_id: req_data.project_id,
        requirement_id: requirementId,
        type: "approved",
        title: "Requirement approved for development",
        message: `"${req_data.title}" has been approved and moved to development.`,
      });

      return new Response(JSON.stringify({ success: true, newStatus: "in_development" }), {
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
