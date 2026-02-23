export type AgentStatus = "pending" | "in-progress" | "completed" | "failed";

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  icon: string;
  status: AgentStatus;
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
  agents: AgentInfo[];
}

export const AGENT_TEMPLATES: Omit<AgentInfo, "id" | "status">[] = [
  { name: "Business Analyst", role: "Requirements Analysis", icon: "FileSearch" },
  { name: "Technical Architect", role: "System Design", icon: "Blocks" },
  { name: "Admin Agent", role: "Access & Config", icon: "Shield" },
  { name: "Developer Agent", role: "Implementation", icon: "Code" },
  { name: "QA Agent", role: "Testing & Validation", icon: "TestTube2" },
  { name: "DevOps Agent", role: "CI/CD & Deployment", icon: "GitBranch" },
];
