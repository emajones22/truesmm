import { useMemo } from "react";
import type { RunStep } from "../types/order";

// Extended run status type
type ExtendedRunStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "failed"
  | "retrying"
  | "executing"
  | "timeout";

interface RunTableProps {
  runs: RunStep[];
  runStatuses?: Array<"pending" | "completed" | "cancelled" | "failed" | "retrying">;
  runErrors?: string[];
  runRetries?: number[];
  runOriginalTimes?: string[];
  runCurrentTimes?: string[];
  runReasons?: string[];
  runActualExecutedTimes?: (string | null)[];
  mode?: "schedule" | "logs";
}

const STATUS_CONFIG: Record<
  ExtendedRunStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  completed: {
    label: "Success",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    icon: "✅",
  },
  pending: {
    label: "Pending",
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    icon: "⏳",
  },
  retrying: {
    label: "Retrying",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    icon: "🔄",
  },
  executing: {
    label: "Executing",
    color: "text-purple-400",
    bg: "bg-purple-500/20",
    icon: "⚡",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-400",
    bg: "bg-red-500/20",
    icon: "❌",
  },
  failed: {
    label: "Failed",
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    icon: "⚠️",
  },
  timeout: {
    label: "Timeout",
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    icon: "⏰",
  },
};

export function RunTable({
  runs,
  runStatuses = [],
  runErrors = [],
  runRetries = [],
  runOriginalTimes = [],
  runCurrentTimes = [],
  runReasons = [],
  runActualExecutedTimes = [],
  mode = "logs",
}: RunTableProps) {
  const safeRuns = runs || [];
  const safeRunStatuses = runStatuses || [];
  const safeRunErrors = runErrors || [];
  const safeRunRetries = runRetries || [];
  const safeRunOriginalTimes = runOriginalTimes || [];
  const safeRunCurrentTimes = runCurrentTimes || [];
  const safeRunReasons = runReasons || [];
  const safeRunActualExecutedTimes = runActualExecutedTimes || [];

  const getTimeDisplay = (index: number, originalRunTime: Date) => {
    const originalTime = safeRunOriginalTimes[index];
    const currentTime = safeRunCurrentTimes[index];

    if (originalTime && currentTime) {
      const origDate = new Date(originalTime);
      const currDate = new Date(currentTime);
      const isRescheduled = origDate.getTime() !== currDate.getTime();
      return { original: origDate, current: currDate, isRescheduled };
    }

    return {
      original: originalRunTime,
      current: originalRunTime,
      isRescheduled: false,
    };
  };

  const getStatus = (index: number): ExtendedRunStatus => {
    const status = safeRunStatuses[index];
    const retryCount = safeRunRetries[index] || 0;
    const reason = safeRunReasons[index];

    if (status === "cancelled") return "cancelled";
    if (status === "failed") return "failed";
    if (status === "completed") return "completed";
    if (reason?.toLowerCase().includes("timeout")) return "timeout";
    if (status === "retrying" || retryCount > 0) return "retrying";
    return "pending";
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) {
      const minutes = Math.abs(Math.floor(diff / (1000 * 60)));
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
    }

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `in ${hours}h`;
  };

  const stats = useMemo(() => {
    return {
      total: safeRuns.length,
      completed: safeRunStatuses.filter((s) => s === "completed").length,
      retrying: safeRunStatuses.filter((s) => s === "retrying").length,
      pending: safeRunStatuses.filter((s) => s === "pending").length,
      cancelled: safeRunStatuses.filter((s) => s === "cancelled").length,
      failed: safeRunStatuses.filter((s) => s === "failed").length,
      totalRetries: safeRunRetries.reduce((sum, r) => sum + (r || 0), 0),
    };
  }, [safeRuns, safeRunStatuses, safeRunRetries]);

  // ============ SCHEDULE MODE (simple preview) ============
  if (mode === "schedule") {
    return (
      <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 bg-gray-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">Run</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Views</th>
              <th className="px-3 py-2">Likes</th>
              <th className="px-3 py-2">Shares</th>
              <th className="px-3 py-2">Saves</th>
              <th className="px-3 py-2">Comments</th>
              <th className="px-3 py-2">Reposts</th>
            </tr>
          </thead>
          <tbody>
            {safeRuns.map((run) => (
              <tr
                key={run.run}
                className="border-t border-slate-800/80 align-top hover:bg-yellow-500/5"
              >
                <td className="px-3 py-2 text-yellow-400 font-medium">
                  #{run.run}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {run.at.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-yellow-400">
                  {(run.views || 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-pink-400">{run.likes || 0}</td>
                <td className="px-3 py-2 text-blue-400">{run.shares || 0}</td>
                <td className="px-3 py-2 text-purple-400">{run.saves || 0}</td>
                <td className="px-3 py-2 text-green-400">
                  {run.comments || 0}
                </td>
                <td className="px-3 py-2 text-cyan-400">
                  {run.reposts || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ============ LOGS MODE (full detailed view) ============
  return (
    <div className="mt-3 space-y-3">
      {/* Stats Summary Pills */}
      {stats.total > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
            ✅ {stats.completed} completed
          </span>
          {stats.retrying > 0 && (
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
              🔄 {stats.retrying} retrying
            </span>
          )}
          {stats.pending > 0 && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-400">
              ⏳ {stats.pending} pending
            </span>
          )}
          {stats.cancelled > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-400">
              ❌ {stats.cancelled} cancelled
            </span>
          )}
          {stats.failed > 0 && (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-400">
              ⚠️ {stats.failed} failed
            </span>
          )}
          {stats.totalRetries > 0 && (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-400">
              ↻ {stats.totalRetries} total retries
            </span>
          )}
        </div>
      )}

      {/* Main Table */}
      <div className="max-h-96 overflow-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 z-10 bg-gray-900 text-slate-400">
            <tr>
              <th className="px-3 py-2 w-12">Run</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2 w-20">Views</th>
              <th className="px-3 py-2 w-14">Likes</th>
              <th className="px-3 py-2 w-16">Shares</th>
              <th className="px-3 py-2 w-14">Saves</th>
              <th className="px-3 py-2 w-14">Cmts</th>
              <th className="px-3 py-2 w-16">Reposts</th>
              <th className="px-3 py-2 w-24">Status</th>
              <th className="px-3 py-2 w-32">Placed At</th>
              <th className="px-3 py-2">Info</th>
            </tr>
          </thead>
          <tbody>
            {safeRuns.map((run, index) => {
              const status = getStatus(index);
              const config = STATUS_CONFIG[status];
              const retryCount = safeRunRetries[index] || 0;
              const error = safeRunErrors[index];
              const reason = safeRunReasons[index];
              const timeData = getTimeDisplay(index, run.at);

              return (
                <tr
                  key={run.run}
                  className={`border-t border-slate-800/80 align-top transition-colors ${
                    status === "retrying"
                      ? "bg-yellow-500/5"
                      : status === "cancelled"
                      ? "bg-red-500/5"
                      : status === "failed"
                      ? "bg-orange-500/5"
                      : status === "completed"
                      ? "bg-emerald-500/5"
                      : "hover:bg-yellow-500/5"
                  }`}
                >
                  {/* Run Number */}
                  <td className="px-3 py-2 font-medium text-yellow-400">
                    #{run.run}
                  </td>

                  {/* Scheduled Time */}
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-300">
                      {formatTime(run.at)}
                      <span className="ml-1 text-slate-600 text-[10px]">
                        ({formatRelativeTime(run.at)})
                      </span>
                    </div>
                    {timeData.isRescheduled && (
                      <div className="text-[9px] text-yellow-500 mt-0.5">
                        ↺ rescheduled from{" "}
                        {formatTime(timeData.original)}
                      </div>
                    )}
                  </td>

                  {/* Quantities */}
                  <td className="px-3 py-2 text-yellow-400 font-medium">
                    {(run.views || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-pink-400">
                    {run.likes || 0}
                  </td>
                  <td className="px-3 py-2 text-blue-400">
                    {run.shares || 0}
                  </td>
                  <td className="px-3 py-2 text-purple-400">
                    {run.saves || 0}
                  </td>
                  <td className="px-3 py-2 text-green-400">
                    {run.comments || 0}
                  </td>
                  <td className="px-3 py-2 text-cyan-400">
                    {run.reposts || 0}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}
                    >
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                    </span>
                  </td>

                  {/* Placed At - actual execution time */}
                  <td className="px-3 py-2">
                    {(() => {
                      const actualTime = safeRunActualExecutedTimes[index];
                      if (actualTime) {
                        const actualDate = new Date(actualTime);
                        const scheduledDate = timeData.original;
                        const delayMs =
                          actualDate.getTime() - scheduledDate.getTime();
                        const delayMin = Math.round(delayMs / 60000);
                        const wasDelayed = delayMin > 2;

                        return (
                          <div className="space-y-0.5">
                            <p
                              className={`text-[10px] font-medium ${
                                wasDelayed
                                  ? "text-yellow-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {actualDate.toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {wasDelayed && (
                              <p className="text-[9px] text-yellow-600">
                                +{delayMin}m delay
                                {retryCount > 0
                                  ? ` (${retryCount} retries)`
                                  : ""}
                              </p>
                            )}
                          </div>
                        );
                      }

                      if (retryCount > 0) {
                        return (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                            ↻ retry {retryCount}
                          </span>
                        );
                      }

                      return (
                        <span className="text-slate-700">—</span>
                      );
                    })()}
                  </td>

                  {/* Info / Error / Reason */}
                  <td className="px-3 py-2 max-w-[200px]">
                    {reason || error ? (
                      <div className="space-y-0.5">
                        {reason && (
                          <p
                            className={`text-[10px] truncate ${
                              reason.toLowerCase().includes("waiting")
                                ? "text-yellow-400"
                                : reason.toLowerCase().includes("timeout")
                                ? "text-orange-400"
                                : reason.toLowerCase().includes("success")
                                ? "text-emerald-400"
                                : "text-slate-500"
                            }`}
                            title={reason}
                          >
                            {reason.length > 40
                              ? `${reason.slice(0, 40)}...`
                              : reason}
                          </p>
                        )}
                        {error && !reason?.includes(error) && (
                          <p
                            className="text-[10px] text-rose-400 truncate"
                            title={error}
                          >
                            ⚠️{" "}
                            {error.length > 35
                              ? `${error.slice(0, 35)}...`
                              : error}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[9px] text-slate-600 pt-1">
        <span>Legend:</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          Retrying
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Cancelled
        </span>
        <span className="flex items-center gap-1">
          <span className="text-yellow-400">Yellow time</span> = Rescheduled
        </span>
        <span className="flex items-center gap-1">
          <span className="text-yellow-400">Placed At</span> = Actual
          execution (yellow = delayed)
        </span>
      </div>
    </div>
  );
}
