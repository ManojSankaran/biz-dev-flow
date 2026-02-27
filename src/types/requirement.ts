export type AgentStatus = "pending" | "in-progress" | "completed" | "failed";

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  icon: string;
  status: AgentStatus;
}

export interface AgentOutput {
  id: string;
  requirementId: string;
  agentName: string;
  content: string;
  outputType: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  reqId: string;
  reqTitle: string;
  agentName: string;
  fromStatus: AgentStatus;
  toStatus: AgentStatus;
}

export type WorkflowStatus =
  | "pending_ba_approval"
  | "ba_approved"
  | "generating_design"
  | "pending_architect_approval"
  | "architect_approved"
  | "in_development"
  | "completed";

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
  agents: AgentInfo[];
  workflowStatus: WorkflowStatus;
}

// New agent order: BA → Architect → Developer → Admin → QA → DevOps
// Agent order: BA → Architect → Admin → Developer → QA → DevOps
export const AGENT_TEMPLATES: Omit<AgentInfo, "id" | "status">[] = [
  { name: "Business Analyst", role: "Requirements Analysis", icon: "FileSearch" },
  { name: "Technical Architect", role: "System Design", icon: "Blocks" },
  { name: "Admin Agent", role: "Access & Config", icon: "Shield" },
  { name: "Developer Agent", role: "Implementation", icon: "Code" },
  { name: "QA Agent", role: "Testing & Validation", icon: "TestTube2" },
  { name: "DevOps Agent", role: "CI/CD & Deployment", icon: "GitBranch" },
];

// Agents that require human approval before proceeding
export const APPROVAL_AGENTS = ["Business Analyst", "Technical Architect"];

// Labels for each agent's output preview
export const AGENT_OUTPUT_LABELS: Record<string, string> = {
  "Business Analyst": "Detailed Requirements",
  "Technical Architect": "Technical Design",
  "Developer Agent": "Generated Code",
  "Admin Agent": "Access & Config Metadata",
  "QA Agent": "Test Cases & Validation",
  "DevOps Agent": "Deployment Pipeline",
};
