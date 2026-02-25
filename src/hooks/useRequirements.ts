import { useState, useCallback, useRef } from "react";
import { Requirement, AGENT_TEMPLATES, AgentStatus, ActivityEntry } from "@/types/requirement";

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
    workflowStatus: "in_development",
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
    workflowStatus: "pending_architect_approval",
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
    workflowStatus: "completed",
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
    workflowStatus: "pending_ba_approval",
    agents: createAgents(),
  },
  {
    id: createId(),
    title: "API Rate Limiter",
    description: "Implement rate limiting middleware with Redis caching",
    priority: "low",
    createdAt: "2026-02-19",
    workflowStatus: "in_development",
    agents: AGENT_TEMPLATES.map((t, i) => ({
      ...t,
      id: createId(),
      status: (["completed", "completed", "completed", "completed", "in-progress", "pending"] as AgentStatus[])[i],
    })),
  },
];

export function useRequirements() {
  const [requirements, setRequirements] = useState<Requirement[]>(INITIAL);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const autoProgressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addActivity = useCallback(
    (reqId: string, reqTitle: string, agentName: string, fromStatus: AgentStatus, toStatus: AgentStatus) => {
      setActivityLog((prev) => [
        {
          id: createId(),
          timestamp: new Date().toISOString(),
          reqId,
          reqTitle,
          agentName,
          fromStatus,
          toStatus,
        },
        ...prev.slice(0, 49), // keep last 50
      ]);
    },
    []
  );

  const addRequirement = useCallback(
    (title: string, description: string, priority: Requirement["priority"]) => {
      setRequirements((prev) => [
        {
          id: createId(),
          title,
          description,
          priority,
          createdAt: new Date().toISOString().split("T")[0],
          workflowStatus: "pending_ba_approval",
          agents: createAgents(),
        },
        ...prev,
      ]);
    },
    []
  );

  const updateAgentStatus = useCallback(
    (reqId: string, agentId: string, status: AgentStatus) => {
      setRequirements((prev) => {
        const req = prev.find((r) => r.id === reqId);
        const agent = req?.agents.find((a) => a.id === agentId);
        if (req && agent) {
          addActivity(reqId, req.title, agent.name, agent.status, status);
        }
        return prev.map((r) =>
          r.id === reqId
            ? { ...r, agents: r.agents.map((a) => (a.id === agentId ? { ...a, status } : a)) }
            : r
        );
      });
    },
    [addActivity]
  );

  const startAutoProgress = useCallback(
    (reqId: string) => {
      // Cancel existing timer
      const existing = autoProgressTimers.current.get(reqId);
      if (existing) clearInterval(existing);

      const tick = () => {
        setRequirements((prev) => {
          const req = prev.find((r) => r.id === reqId);
          if (!req) return prev;

          // Find first non-completed agent
          const nextAgent = req.agents.find(
            (a) => a.status === "pending" || a.status === "in-progress"
          );
          if (!nextAgent) {
            // All done, clear interval
            const timer = autoProgressTimers.current.get(reqId);
            if (timer) clearInterval(timer);
            autoProgressTimers.current.delete(reqId);
            return prev;
          }

          const newStatus: AgentStatus =
            nextAgent.status === "pending" ? "in-progress" : "completed";
          addActivity(reqId, req.title, nextAgent.name, nextAgent.status, newStatus);

          return prev.map((r) =>
            r.id === reqId
              ? {
                  ...r,
                  agents: r.agents.map((a) =>
                    a.id === nextAgent.id ? { ...a, status: newStatus } : a
                  ),
                }
              : r
          );
        });
      };

      const timer = setInterval(tick, 1500);
      autoProgressTimers.current.set(reqId, timer);
      tick(); // Start immediately
    },
    [addActivity]
  );

  const deleteRequirement = useCallback((reqId: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== reqId));
    const timer = autoProgressTimers.current.get(reqId);
    if (timer) {
      clearInterval(timer);
      autoProgressTimers.current.delete(reqId);
    }
  }, []);

  return {
    requirements,
    activityLog,
    addRequirement,
    updateAgentStatus,
    startAutoProgress,
    deleteRequirement,
  };
}
