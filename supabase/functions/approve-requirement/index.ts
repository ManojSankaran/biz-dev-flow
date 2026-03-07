import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Agent order after Architect approval: Admin → Developer → QA → DevOps
const DOWNSTREAM_AGENTS = [
  { name: "Admin Agent", outputType: "metadata" },
  { name: "Developer Agent", outputType: "code" },
  { name: "QA Agent", outputType: "test_cases" },
  { name: "DevOps Agent", outputType: "deployment" },
];

function buildAgentPrompt(
  agentName: string,
  reqTitle: string,
  reqDescription: string,
  projectTitle: string,
  designContent: string,
  devopsConfig: any
): string {
  const structureInfo = devopsConfig
    ? `\n\nSalesforce Project Structure: ${devopsConfig.project_structure === "sfdx" ? "SFDX (force-app/main/default/)" : devopsConfig.project_structure === "mdapi" ? "MDAPI (src/)" : "Auto-detect"}\nRepository: ${devopsConfig.repo_url}\nBranch: ${devopsConfig.branch}`
    : "";

  const sfdxPaths = `
Salesforce DX Folder Structure (force-app/main/default/):
- Apex Classes: force-app/main/default/classes/
- Apex Triggers: force-app/main/default/triggers/
- LWC Components: force-app/main/default/lwc/
- Aura Components: force-app/main/default/aura/
- Custom Objects: force-app/main/default/objects/
- Custom Fields: force-app/main/default/objects/<ObjectName>/fields/
- Validation Rules: force-app/main/default/objects/<ObjectName>/validationRules/
- Layouts: force-app/main/default/objects/<ObjectName>/layouts/
- Flows: force-app/main/default/flows/
- Permission Sets: force-app/main/default/permissionsets/
- Profiles: force-app/main/default/profiles/
- Custom Labels: force-app/main/default/labels/
- Static Resources: force-app/main/default/staticresources/
- Visualforce Pages: force-app/main/default/pages/
- Visualforce Components: force-app/main/default/components/
- Email Templates: force-app/main/default/email/
- Reports: force-app/main/default/reports/
- Dashboards: force-app/main/default/dashboards/`;

  const mdapiPaths = `
Metadata API Folder Structure (src/):
- Apex Classes: src/classes/
- Apex Triggers: src/triggers/
- Custom Objects: src/objects/
- Layouts: src/layouts/
- Flows: src/flows/
- Permission Sets: src/permissionsets/
- Profiles: src/profiles/
- Pages: src/pages/
- Components: src/components/
- Static Resources: src/staticresources/
- Labels: src/labels/
- Email Templates: src/email/`;

  const folderStructure = devopsConfig?.project_structure === "mdapi" ? mdapiPaths : sfdxPaths;

  const prompts: Record<string, string> = {
    "Admin Agent": `You are a Salesforce Admin Agent. Based on the requirement and technical design, generate proper Salesforce admin/configuration metadata.

Requirement: ${reqTitle}
Description: ${reqDescription}
Project: ${projectTitle}
${structureInfo}

${folderStructure}

Generate COMPLETE and VALID Salesforce metadata XML for each component. Include:

1. **Custom Objects** (if needed): Full .object-meta.xml with proper API names (ending in __c), label, pluralLabel, nameField, sharingModel, deploymentStatus
2. **Custom Fields**: Full .field-meta.xml for each field with proper type, label, length/precision, required, description. Use correct field types: Text, Number, Picklist, Lookup, MasterDetail, Checkbox, Date, DateTime, Email, Phone, URL, Currency, Percent, LongTextArea, RichTextArea, Formula
3. **Validation Rules**: Full .validationRule-meta.xml with errorConditionFormula, errorDisplayField, errorMessage
4. **Record Types**: If applicable, proper .recordType-meta.xml
5. **Page Layouts**: Layout assignments and field placements
6. **Permission Sets**: Full .permissionset-meta.xml with field permissions, object permissions, tab settings
7. **Custom Labels**: .labels-meta.xml for all user-facing strings
8. **List Views**: .listView-meta.xml with filter criteria and columns

For EACH metadata file, specify:
- The EXACT file path where it should be deployed
- The complete XML content with proper namespace (xmlns="http://soap.sforce.com/2006/04/metadata")
- API version (use 59.0)

Format as markdown with file paths as headers and XML in code blocks.`,

    "Developer Agent": `You are a Salesforce Developer Agent. Based on the requirement and technical design, generate proper Salesforce Apex code and LWC components.

Requirement: ${reqTitle}
Description: ${reqDescription}
Project: ${projectTitle}
${structureInfo}

${folderStructure}

Generate COMPLETE, DEPLOYABLE Salesforce code. Include:

1. **Apex Classes**: 
   - Service classes with proper separation of concerns
   - Selector/Query classes for SOQL
   - Domain classes for business logic
   - Controller classes for LWC/VF if needed
   - Each class must have: proper API version header, class-level documentation, @AuraEnabled methods where applicable
   - Include corresponding .cls-meta.xml with apiVersion and status

2. **Apex Triggers**:
   - Use Trigger Handler pattern (one trigger per object)
   - Include TriggerHandler base class if not existing
   - Include corresponding .trigger-meta.xml

3. **Lightning Web Components (LWC)**:
   - Complete .js, .html, .css, .js-meta.xml for each component
   - Proper @api, @wire, @track decorators
   - js-meta.xml with proper targets (lightning__RecordPage, lightning__AppPage, etc.)
   - Use Lightning Design System (SLDS) classes

4. **Aura Components** (only if explicitly needed):
   - Complete .cmp, .js controller, .js helper, .design, .css

For EACH file, specify the EXACT deployment path and complete file content.
Format as markdown with file paths as headers and code in appropriate code blocks.`,

    "QA Agent": `You are a Salesforce QA Agent. Based on the requirement and technical design, generate comprehensive Salesforce test cases and Apex test classes.

Requirement: ${reqTitle}
Description: ${reqDescription}
Project: ${projectTitle}
${structureInfo}

${folderStructure}

Generate:

1. **Apex Test Classes**:
   - @isTest annotated classes with proper test methods
   - Test data factory/utility class for creating test records
   - Positive, negative, and bulk test scenarios (200+ records)
   - System.assert, System.assertEquals, System.assertNotEquals validations
   - Test methods for each Apex class and trigger
   - Include corresponding .cls-meta.xml
   - Aim for 90%+ code coverage

2. **Test Scenarios Table** (markdown table):
   | Test Case ID | Description | Steps | Expected Result | Type |
   - Include unit, integration, bulk, security, and boundary tests

3. **Validation Test Cases**:
   - Validation rule trigger scenarios
   - Field-level security tests
   - Sharing rule and permission set tests
   - Profile-based access tests

4. **LWC Test Cases** (Jest):
   - Component rendering tests
   - Wire adapter mock tests
   - User interaction tests

For EACH test file, specify the EXACT deployment path.
Format as markdown with file paths as headers and code in code blocks.`,

    "DevOps Agent": `You are a Salesforce DevOps Agent. Based on the requirement, technical design, and project configuration, generate deployment pipeline and configuration.

Requirement: ${reqTitle}
Description: ${reqDescription}
Project: ${projectTitle}
${structureInfo}

${folderStructure}

${devopsConfig ? `Repository: ${devopsConfig.repo_url}
Branch: ${devopsConfig.branch}
Provider: ${devopsConfig.provider}` : "No repository configured yet."}

Generate:

1. **package.xml** (for deployment):
   - Complete package.xml listing ALL metadata types and members generated by other agents
   - Proper API version (59.0)
   - Include: ApexClass, ApexTrigger, CustomObject, CustomField, ValidationRule, Layout, PermissionSet, LightningComponentBundle, CustomLabel, Flow

2. **Deployment Script**:
   - sfdx force:source:deploy commands for SFDX structure
   - sfdx force:mdapi:deploy commands for MDAPI structure
   - Include validation-only deployment command
   - Include quick deploy command after successful validation

3. **CI/CD Pipeline** (for ${devopsConfig?.provider || "GitHub"}):
${devopsConfig?.provider === "azure_devops" ? "   - azure-pipelines.yml with stages: Validate → Test → Deploy" :
  devopsConfig?.provider === "gitlab" ? "   - .gitlab-ci.yml with stages: validate, test, deploy" :
  devopsConfig?.provider === "bitbucket" ? "   - bitbucket-pipelines.yml with steps: validate, test, deploy" :
  "   - .github/workflows/deploy.yml with jobs: validate, test, deploy"}
   - Authentication using SFDX auth URL or JWT flow
   - Run all Apex tests before deployment
   - Separate stages for sandbox and production

4. **Deployment Checklist**:
   - Pre-deployment steps (backup, feature flags)
   - Deployment order (objects → fields → classes → triggers → LWC → permissions)
   - Post-deployment verification steps
   - Rollback procedure

5. **Folder Mapping Summary**:
   List every file generated by all agents and its exact deployment path in the repository.

Format as markdown with config in code blocks.`,
  };

  return prompts[agentName] || `Generate output for ${agentName}: ${reqTitle}`;
}

async function generateAgentOutput(
  supabase: any,
  requirementId: string,
  reqTitle: string,
  reqDescription: string,
  projectTitle: string,
  agentName: string,
  outputType: string,
  designContent: string,
  apiKey: string,
  devopsConfig: any
) {
  const prompt = buildAgentPrompt(agentName, reqTitle, reqDescription, projectTitle, designContent, devopsConfig);

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `You are a ${agentName} specializing in Salesforce development. Produce complete, deployable, production-ready Salesforce metadata and code. Always include exact file paths for deployment.` },
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

    // Fetch DevOps config for this project
    const { data: devopsConfig } = await supabase
      .from("project_devops_config")
      .select("*")
      .eq("project_id", req_data.project_id)
      .maybeSingle();

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

      const structureInfo = devopsConfig
        ? `\nSalesforce Project Structure: ${devopsConfig.project_structure === "sfdx" ? "SFDX (force-app/main/default/)" : devopsConfig.project_structure === "mdapi" ? "MDAPI (src/)" : "Auto-detect"}
Repository: ${devopsConfig.repo_url}
Branch: ${devopsConfig.branch}
Provider: ${devopsConfig.provider}`
        : "";

      const sfdxPaths = `
Salesforce DX Folder Structure (force-app/main/default/):
- Apex Classes: force-app/main/default/classes/
- Apex Triggers: force-app/main/default/triggers/
- LWC Components: force-app/main/default/lwc/
- Aura Components: force-app/main/default/aura/
- Custom Objects: force-app/main/default/objects/
- Custom Fields: force-app/main/default/objects/<ObjectName>/fields/
- Validation Rules: force-app/main/default/objects/<ObjectName>/validationRules/
- Flows: force-app/main/default/flows/
- Permission Sets: force-app/main/default/permissionsets/`;

      const mdapiPaths = `
Metadata API Folder Structure (src/):
- Apex Classes: src/classes/
- Apex Triggers: src/triggers/
- Custom Objects: src/objects/
- Flows: src/flows/
- Permission Sets: src/permissionsets/`;

      const folderStructure = devopsConfig?.project_structure === "mdapi" ? mdapiPaths : sfdxPaths;

      const designPrompt = `You are a Salesforce Technical Architect. Generate a technical design document for a Salesforce implementation.

Requirement: ${req_data.title}
Description: ${req_data.description || ""}
Project: ${project.title}
${structureInfo}

${folderStructure}

Create a comprehensive Salesforce technical design covering:

1. **Architecture Overview**: High-level solution architecture on the Salesforce platform
2. **Data Model**: 
   - Custom Objects with API names (ending in __c), relationships (Lookup/Master-Detail)
   - Custom Fields with data types, lengths, and default values
   - Record Types if applicable
3. **Apex Architecture**:
   - Service layer classes
   - Trigger handler pattern
   - Selector/query classes
   - Integration classes (if external systems involved)
4. **UI Components**:
   - Lightning Web Components (LWC) with component hierarchy
   - Aura components (only if legacy support needed)
   - Lightning App Builder page layouts
5. **Security Design**:
   - Object-level security (profiles, permission sets)
   - Field-level security
   - Sharing rules and record access
   - Org-wide defaults
6. **Integration Design** (if applicable):
   - REST/SOAP callouts
   - Platform Events
   - Change Data Capture
7. **Governor Limits Considerations**:
   - Bulkification strategy
   - SOQL query optimization
   - DML optimization
8. **Deployment File Paths**: 
   - For each component, specify the exact file path in the ${devopsConfig?.project_structure === "mdapi" ? "MDAPI" : "SFDX"} project structure
   - Align all paths with the configured folder structure above

Format as clean markdown with proper sections.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a senior Salesforce technical architect. Produce detailed, Salesforce-specific technical designs." },
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
          project.title, agent.name, agent.outputType, designContent, LOVABLE_API_KEY, devopsConfig
        );

        await supabase.from("requirement_agents").update({ status: result ? "completed" : "failed" }).eq("requirement_id", requirementId).eq("agent_name", agent.name);
      });

      await Promise.all(promises);

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
