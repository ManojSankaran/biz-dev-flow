import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CircleDot, Link2, Unlink, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkflowStatus } from "@/types/requirement";

interface GraphRequirement {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  workflowStatus: WorkflowStatus;
  dependsOn: string[];
}

interface Props {
  requirements: GraphRequirement[];
}

interface NodePosition {
  x: number;
  y: number;
  level: number;
  column: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending_ba_approval: "border-muted-foreground/40 bg-muted/30",
  ba_approved: "border-primary/40 bg-primary/10",
  generating_design: "border-accent/40 bg-accent/10",
  pending_architect_approval: "border-primary/40 bg-primary/10",
  architect_approved: "border-primary/60 bg-primary/15",
  in_development: "border-chart-4/40 bg-chart-4/10",
  completed: "border-chart-2/40 bg-chart-2/10",
};

const PRIORITY_RING: Record<string, string> = {
  critical: "ring-2 ring-destructive/50",
  high: "ring-2 ring-chart-4/50",
  medium: "ring-1 ring-primary/30",
  low: "",
};

function detectCycles(requirements: GraphRequirement[]): Set<string> {
  const adj = new Map<string, string[]>();
  requirements.forEach((r) => adj.set(r.id, r.dependsOn));
  
  const inCycle = new Set<string>();
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      path.slice(cycleStart).forEach((n) => inCycle.add(n));
      inCycle.add(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const dep of adj.get(node) || []) {
      if (adj.has(dep)) dfs(dep, path);
    }

    stack.delete(node);
    path.pop();
    return false;
  }

  requirements.forEach((r) => {
    if (!visited.has(r.id)) dfs(r.id, []);
  });
  return inCycle;
}

function findCriticalPath(requirements: GraphRequirement[]): Set<string> {
  const reqMap = new Map(requirements.map((r) => [r.id, r]));
  const memo = new Map<string, number>();
  const criticalNodes = new Set<string>();

  function longestPath(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    if (memo.has(id)) return memo.get(id)!;
    visited.add(id);
    const req = reqMap.get(id);
    if (!req) return 0;

    let maxChild = 0;
    const dependents = requirements.filter((r) => r.dependsOn.includes(id));
    for (const dep of dependents) {
      maxChild = Math.max(maxChild, longestPath(dep.id, new Set(visited)));
    }
    const result = 1 + maxChild;
    memo.set(id, result);
    return result;
  }

  // Roots are requirements that no one depends on as blockers AND have no dependencies themselves
  const roots = requirements.filter((r) => r.dependsOn.length === 0);
  
  let longestTotal = 0;
  let longestRoot = "";
  for (const root of roots) {
    const len = longestPath(root.id, new Set());
    if (len > longestTotal) {
      longestTotal = len;
      longestRoot = root.id;
    }
  }

  // Trace critical path
  if (longestRoot && longestTotal > 1) {
    function trace(id: string) {
      criticalNodes.add(id);
      const dependents = requirements.filter((r) => r.dependsOn.includes(id));
      let best = "";
      let bestLen = 0;
      for (const dep of dependents) {
        const len = memo.get(dep.id) || 0;
        if (len > bestLen) {
          bestLen = len;
          best = dep.id;
        }
      }
      if (best) trace(best);
    }
    trace(longestRoot);
  }

  return criticalNodes;
}

function computeLayout(requirements: GraphRequirement[]): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const reqMap = new Map(requirements.map((r) => [r.id, r]));
  const levels = new Map<string, number>();

  // Compute levels via topological ordering
  function getLevel(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    if (levels.has(id)) return levels.get(id)!;
    visited.add(id);
    const req = reqMap.get(id);
    if (!req || req.dependsOn.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    let maxParent = 0;
    for (const dep of req.dependsOn) {
      if (reqMap.has(dep)) {
        maxParent = Math.max(maxParent, getLevel(dep, visited) + 1);
      }
    }
    levels.set(id, maxParent);
    return maxParent;
  }

  requirements.forEach((r) => getLevel(r.id, new Set()));

  // Group by level
  const byLevel = new Map<number, string[]>();
  requirements.forEach((r) => {
    const level = levels.get(r.id) || 0;
    const list = byLevel.get(level) || [];
    list.push(r.id);
    byLevel.set(level, list);
  });

  const NODE_W = 220;
  const NODE_H = 100;
  const GAP_X = 60;
  const GAP_Y = 40;

  byLevel.forEach((ids, level) => {
    ids.forEach((id, col) => {
      positions.set(id, {
        x: level * (NODE_W + GAP_X),
        y: col * (NODE_H + GAP_Y),
        level,
        column: col,
      });
    });
  });

  return positions;
}

function getBlockedBy(reqId: string, requirements: GraphRequirement[]): string[] {
  const req = requirements.find((r) => r.id === reqId);
  if (!req) return [];
  return req.dependsOn.filter((depId) => {
    const dep = requirements.find((r) => r.id === depId);
    return dep && dep.workflowStatus !== "completed";
  });
}

function getBlocking(reqId: string, requirements: GraphRequirement[]): string[] {
  return requirements.filter((r) => r.dependsOn.includes(reqId)).map((r) => r.id);
}

export function DependencyGraph({ requirements }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const graphReqs = useMemo(
    () => requirements.filter((r) => r.dependsOn.length > 0 || requirements.some((o) => o.dependsOn.includes(r.id))),
    [requirements]
  );

  const isolated = useMemo(
    () => requirements.filter((r) => r.dependsOn.length === 0 && !requirements.some((o) => o.dependsOn.includes(r.id))),
    [requirements]
  );

  const cycles = useMemo(() => detectCycles(graphReqs), [graphReqs]);
  const criticalPath = useMemo(() => findCriticalPath(graphReqs), [graphReqs]);
  const positions = useMemo(() => computeLayout(graphReqs), [graphReqs]);
  const reqMap = useMemo(() => new Map(requirements.map((r) => [r.id, r])), [requirements]);

  const selectedReq = selected ? reqMap.get(selected) : null;
  const blockedBy = selected ? getBlockedBy(selected, requirements) : [];
  const blocking = selected ? getBlocking(selected, requirements) : [];

  // Compute SVG size
  const maxX = Math.max(0, ...Array.from(positions.values()).map((p) => p.x)) + 240;
  const maxY = Math.max(0, ...Array.from(positions.values()).map((p) => p.y)) + 120;

  // Edges
  const edges = useMemo(() => {
    const result: { from: string; to: string; isCycle: boolean; isCritical: boolean }[] = [];
    graphReqs.forEach((req) => {
      req.dependsOn.forEach((depId) => {
        if (positions.has(depId) && positions.has(req.id)) {
          result.push({
            from: depId,
            to: req.id,
            isCycle: cycles.has(depId) && cycles.has(req.id),
            isCritical: criticalPath.has(depId) && criticalPath.has(req.id),
          });
        }
      });
    });
    return result;
  }, [graphReqs, positions, cycles, criticalPath]);

  if (requirements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Unlink className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">No requirements yet</p>
        <p className="text-sm mt-1">Add requirements to see dependency relationships</p>
      </div>
    );
  }

  if (graphReqs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Unlink className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">No dependencies configured</p>
        <p className="text-sm mt-1">Set dependencies on requirements to visualize relationships</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend & Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-3 w-3 rounded-full bg-chart-2/60" />
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-3 w-3 rounded-full bg-destructive/60" />
          <span>Circular Dependency</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-3 w-6 border-t-2 border-dashed border-muted-foreground/40" />
          <span>Dependency Edge</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] font-mono">
            {graphReqs.length} connected
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {isolated.length} isolated
          </Badge>
          {cycles.size > 0 && (
            <Badge variant="destructive" className="text-[10px] font-mono gap-1">
              <AlertTriangle className="h-3 w-3" />
              {cycles.size} in cycles
            </Badge>
          )}
        </div>
      </div>

      {/* Cycle Warning */}
      {cycles.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Circular Dependencies Detected</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The following requirements form circular dependency chains and may block progress:{" "}
              {Array.from(cycles)
                .map((id) => reqMap.get(id)?.title || id.slice(0, 8))
                .join(", ")}
            </p>
          </div>
        </motion.div>
      )}

      {/* Graph Canvas */}
      <div className="rounded-xl border bg-card overflow-auto">
        <div className="p-4" style={{ minWidth: maxX + 40, minHeight: maxY + 40 }}>
          <svg
            width={maxX + 40}
            height={maxY + 40}
            className="absolute pointer-events-none"
            style={{ zIndex: 0 }}
          >
            {edges.map((edge, i) => {
              const from = positions.get(edge.from)!;
              const to = positions.get(edge.to)!;
              const x1 = from.x + 200;
              const y1 = from.y + 40;
              const x2 = to.x + 20;
              const y2 = to.y + 40;
              const midX = (x1 + x2) / 2;

              const strokeColor = edge.isCycle
                ? "hsl(var(--destructive))"
                : edge.isCritical
                ? "hsl(var(--chart-2))"
                : "hsl(var(--muted-foreground) / 0.3)";

              const isHighlighted = selected && (edge.from === selected || edge.to === selected);

              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={edge.isCycle ? "6 4" : undefined}
                    opacity={selected && !isHighlighted ? 0.15 : 0.8}
                    className="transition-opacity duration-200"
                  />
                  {/* Arrow */}
                  <circle cx={x2} cy={y2} r={3} fill={strokeColor} opacity={selected && !isHighlighted ? 0.15 : 0.8} />
                </g>
              );
            })}
          </svg>

          <div className="relative" style={{ width: maxX + 20, height: maxY + 20 }}>
            {graphReqs.map((req) => {
              const pos = positions.get(req.id);
              if (!pos) return null;
              const isInCycle = cycles.has(req.id);
              const isOnCriticalPath = criticalPath.has(req.id);
              const isSelected = selected === req.id;
              const isRelated = selected && (blockedBy.includes(req.id) || blocking.includes(req.id));
              const dimmed = selected && !isSelected && !isRelated && !blockedBy.includes(req.id) && !blocking.includes(req.id);

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: dimmed ? 0.3 : 1, scale: 1 }}
                  className={cn(
                    "absolute w-[200px] rounded-lg border-2 p-3 cursor-pointer transition-all duration-200",
                    STATUS_COLORS[req.workflowStatus] || "border-border bg-card",
                    PRIORITY_RING[req.priority],
                    isInCycle && "border-destructive/60 bg-destructive/5",
                    isOnCriticalPath && !isInCycle && "border-chart-2/60 bg-chart-2/5",
                    isSelected && "shadow-lg scale-105 z-10"
                  )}
                  style={{ left: pos.x + 20, top: pos.y + 20 }}
                  onClick={() => setSelected(isSelected ? null : req.id)}
                >
                  <div className="flex items-start gap-1.5">
                    {isInCycle && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />}
                    {isOnCriticalPath && !isInCycle && <Zap className="h-3.5 w-3.5 text-chart-2 flex-shrink-0 mt-0.5" />}
                    <p className="text-xs font-semibold text-card-foreground line-clamp-2 leading-tight">{req.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {req.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {req.workflowStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {req.dependsOn.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      <span>{req.dependsOn.length} {req.dependsOn.length === 1 ? "dependency" : "dependencies"}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Impact Analysis Panel */}
      {selectedReq && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-card-foreground">
              Impact Analysis: {selectedReq.title}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blocked By (must complete first)</p>
              {blockedBy.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No active blockers</p>
              ) : (
                <div className="space-y-1">
                  {blockedBy.map((id) => {
                    const dep = reqMap.get(id);
                    return dep ? (
                      <div key={id} className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-2.5 py-1.5">
                        <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                        <span className="text-xs font-medium text-card-foreground truncate">{dep.title}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto flex-shrink-0">
                          {dep.workflowStatus.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blocking (waiting on this)</p>
              {blocking.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Not blocking any requirements</p>
              ) : (
                <div className="space-y-1">
                  {blocking.map((id) => {
                    const dep = reqMap.get(id);
                    return dep ? (
                      <div key={id} className="flex items-center gap-2 rounded-md bg-chart-4/5 border border-chart-4/20 px-2.5 py-1.5">
                        <ArrowRight className="h-3 w-3 text-chart-4 flex-shrink-0" />
                        <span className="text-xs font-medium text-card-foreground truncate">{dep.title}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto flex-shrink-0">
                          {dep.workflowStatus.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          {cycles.has(selected!) && (
            <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-xs text-destructive">
                This requirement is part of a circular dependency chain. Resolve by removing one of the dependency links.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Isolated Requirements */}
      {isolated.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Isolated Requirements (no dependencies)
          </h4>
          <div className="flex flex-wrap gap-2">
            {isolated.map((req) => (
              <Tooltip key={req.id}>
                <TooltipTrigger asChild>
                  <div className={cn("rounded-md border px-2.5 py-1.5 text-xs font-medium text-card-foreground", STATUS_COLORS[req.workflowStatus])}>
                    {req.title}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{req.priority} priority · {req.workflowStatus.replace(/_/g, " ")}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
