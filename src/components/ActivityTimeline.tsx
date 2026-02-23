import { ActivityEntry } from "@/types/requirement";
import { StatusBadge } from "./StatusBadge";
import { ArrowRight, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  entries: ActivityEntry[];
}

export function ActivityTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs mt-1">Change agent statuses to see the timeline</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      <AnimatePresence>
        {entries.map((entry, idx) => {
          const time = new Date(entry.timestamp);
          const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const dateStr = time.toLocaleDateString([], { month: "short", day: "numeric" });

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="relative flex items-start gap-4 pl-10 py-3 hover:bg-secondary/20 rounded-lg transition-colors"
            >
              {/* Dot */}
              <div className="absolute left-[11px] top-4 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-card-foreground">{entry.agentName}</span>
                  <span className="text-xs text-muted-foreground">in</span>
                  <span className="text-sm font-medium text-primary truncate">{entry.reqTitle}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={entry.fromStatus} size="xs" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <StatusBadge status={entry.toStatus} size="xs" />
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-[10px] font-mono text-muted-foreground">{timeStr}</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">{dateStr}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
