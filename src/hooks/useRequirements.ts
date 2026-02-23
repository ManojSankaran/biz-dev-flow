import { useState } from "react";
import { Requirement, AGENT_TEMPLATES, AgentStatus } from "@/types/requirement";

const createId = () => Math.random().toString(36).slice(2, 10);

const createAgents = () =>
  AGENT_TEMPLATES.map((t) => ({
    ...t,
    id: createId(),
    status: "pending" as AgentStatus,
  }));

const INITIAL: Requirement[] = [
  {
    id: createId(),
    title: "User Authentication Module",
    description: "Implement login, signup, password reset with OAuth2 integration",
    priority: "critical",
    createdAt: "2026-02-20",
    agents: AGENT_TEMPLATES.map((t, i) => ({
      ...t,
      id: createId(),
      status: (["completed", "completed", "in-progress", "pending", "pending", "pending"] as AgentStatus[])[i],
    })),
  },
  {
    id: createId(),
    title: "Dashboard Analytics",
    description: "Real-time metrics dashboard with charts and KPI tracking",
    priority: "high",
    createdAt: "2026-02-21",
    agents: AGENT_TEMPLATES.map((t, i) => ({
      ...t,
      id: createId(),
      status: (["completed", "in-progress", "pending", "pending", "pending", "pending"] as AgentStatus[])[i],
    })),
  },
  {
    id: createId(),
    title: "Payment Gateway Integration",
    description: "Stripe and PayPal integration for subscription billing",
    priority: "high",
    createdAt: "2026-02-22",
    agents: AGENT_TEMPLATES.map((t, i) => ({
      ...t,
      id: createId(),
      status: (["completed", "completed", "completed", "completed", "completed", "failed"] as AgentStatus[])[i],
    })),
  },
  {
    id: createId(),
    title: "Notification System",
    description: "Email, SMS, and push notification service",
    priority: "medium",
    createdAt: "2026-02-23",
    agents: createAgents(),
  },
];

export function useRequirements() {
  const [requirements, setRequirements] = useState<Requirement[]>(INITIAL);

  const addRequirement = (title: string, description: string, priority: Requirement["priority"]) => {
    setRequirements((prev) => [
      {
        id: createId(),
        title,
        description,
        priority,
        createdAt: new Date().toISOString().split("T")[0],
        agents: createAgents(),
      },
      ...prev,
    ]);
  };

  const updateAgentStatus = (reqId: string, agentId: string, status: AgentStatus) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              agents: r.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
            }
          : r
      )
    );
  };

  return { requirements, addRequirement, updateAgentStatus };
}
