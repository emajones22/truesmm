import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PatternPlan, QuickPatternPreset, DeliveryOption } from "../types/order";

// 🔥 Favourite = config settings, NOT raw runs
interface FavouriteConfig {
  id: string;
  savedAt: string;
  name: string;
  patternName: string;
  patternType: PatternPlan["patternType"];
  totalRuns: number;
  estimatedDurationHours: number;
  approximateIntervalMin: number;
  finishTime: string;
  risk: PatternPlan["risk"];
  quickPreset: QuickPatternPreset | null;
  variancePercent: number;
  delivery: DeliveryOption;
  includeLikes: boolean;
  includeShares: boolean;
  includeSaves: boolean;
  includeComments: boolean;
  includeReposts: boolean;
  peakHoursBoost: boolean;
  // 🔥 Save actual runs as proportions (0-1) of total views
  runProportions: Array<{
    minutesFromStart: number;
    viewsFraction: number;
    likesFraction: number;
    sharesFraction: number;
    savesFraction: number;
    commentsFraction: number;
    repostsFraction: number;
  }>;
  savedTotalViews: number;
}

interface GrowthGraphProps {
  plan: PatternPlan;
  selectedPreset?: QuickPatternPreset | null;
  variancePercent?: number;
  delivery?: DeliveryOption;
  includeLikes?: boolean;
  includeShares?: boolean;
  includeSaves?: boolean;
  includeComments?: boolean;
  includeReposts?: boolean;
  peakHoursBoost?: boolean;
  onApplyPreset?: (preset: QuickPatternPreset) => void;
  onGenerate?: () => void;
  onApplyFavourite?: (config: FavouriteConfig) => void;
}

type GraphMode = "smooth" | "stepped";

const FAVOURITES_KEY = "dev-smm-favourite-configs";

function readFavourites(): FavouriteConfig[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavouritesToStorage(favs: FavouriteConfig[]) {
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favs));
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const presetButtons: Array<{ label: string; value: QuickPatternPreset }> = [
  { label: "🚀 Viral Boost", value: "viral-boost" },
  { label: "⚡ Fast Start", value: "fast-start" },
  { label: "🔥 Trending Push", value: "trending-push" },
  { label: "🌊 Slow Burn", value: "slow-burn" },
];

function lineTypeForPattern(patternType: PatternPlan["patternType"]) {
  if (patternType === "sawtooth") return "stepAfter";
  if (patternType === "viral-spike" || patternType === "micro-burst") return "linear";
  if (patternType === "heartbeat") return "natural";
  return "monotoneX";
}

function buildSmoothGraphData(plan: PatternPlan) {
  const safeRuns = plan?.runs || [];
  const rows: Array<{
    label: string;
    views: number;
    likes: number;
    shares: number;
    saves: number;
    reposts: number;
    comments: number;
  }> = [];

  rows.push({ label: "0m", views: 0, likes: 0, shares: 0, saves: 0, reposts: 0, comments: 0 });

  for (let index = 0; index < safeRuns.length; index += 1) {
    const current = safeRuns[index];
    const previous =
      index === 0
        ? {
            minutesFromStart: 0,
            cumulativeViews: 0,
            cumulativeLikes: 0,
            cumulativeShares: 0,
            cumulativeSaves: 0,
            cumulativeReposts: 0,
            cumulativeComments: 0,
          }
        : safeRuns[index - 1];

    const dt = Math.max(1, current.minutesFromStart - previous.minutesFromStart);
    const phase = index / Math.max(1, safeRuns.length - 1);
    const segmentNoise = clamp(
      0.01 + (current.views / Math.max(1, safeRuns[0]?.views ?? 1)) * 0.004,
      0.01,
      0.03
    );

    const pointValue = (
      start: number,
      end: number,
      progress: number,
      wobbleScale: number,
      preserveMonotone: boolean
    ) => {
      const eased = Math.pow(progress, phase < 0.2 ? 1.8 : phase > 0.8 ? 0.88 : 1.05);
      const delta = end - start;
      const wobble = delta * segmentNoise * wobbleScale;
      const value = start + delta * eased + wobble;
      if (!preserveMonotone) return Math.max(0, value);
      return clamp(value, Math.min(start, end), Math.max(start, end));
    };

    const wave = Math.sin((index + 1) * 1.13 + phase * Math.PI * 1.7);
    const minuteA = previous.minutesFromStart + dt * 0.38;
    const minuteB = previous.minutesFromStart + dt * 0.76;

    rows.push({
      label: `${Math.round(minuteA)}m`,
      views: pointValue(previous.cumulativeViews, current.cumulativeViews, 0.38, wave * 0.7, true),
      likes: pointValue(previous.cumulativeLikes, current.cumulativeLikes, 0.38, wave * 0.8, false),
      shares: pointValue(previous.cumulativeShares, current.cumulativeShares, 0.38, wave * 0.75, false),
      saves: pointValue(previous.cumulativeSaves, current.cumulativeSaves, 0.38, wave * 0.85, false),
      reposts: pointValue(previous.cumulativeReposts, current.cumulativeReposts, 0.38, wave * 0.82, false),
      comments: pointValue(previous.cumulativeComments, current.cumulativeComments, 0.38, wave * 0.9, false),
    });

    rows.push({
      label: `${Math.round(minuteB)}m`,
      views: pointValue(previous.cumulativeViews, current.cumulativeViews, 0.76, wave * -0.55, true),
      likes: pointValue(previous.cumulativeLikes, current.cumulativeLikes, 0.76, wave * -0.62, false),
      shares: pointValue(previous.cumulativeShares, current.cumulativeShares, 0.76, wave * -0.58, false),
      saves: pointValue(previous.cumulativeSaves, current.cumulativeSaves, 0.76, wave * -0.64, false),
      reposts: pointValue(previous.cumulativeReposts, current.cumulativeReposts, 0.76, wave * -0.61, false),
      comments: pointValue(previous.cumulativeComments, current.cumulativeComments, 0.76, wave * -0.7, false),
    });

    rows.push({
      label: current.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      views: current.cumulativeViews,
      likes: current.cumulativeLikes,
      shares: current.cumulativeShares,
      saves: current.cumulativeSaves,
      reposts: current.cumulativeReposts,
      comments: current.cumulativeComments,
    });
  }

  return rows;
}

function buildSteppedGraphData(plan: PatternPlan) {
  const safeRuns = plan?.runs || [];
  return safeRuns.map((run) => ({
    time: run.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    views: run.cumulativeViews || 0,
    likes: (run.cumulativeLikes || 0) * 10,
    shares: (run.cumulativeShares || 0) * 10,
    saves: (run.cumulativeSaves || 0) * 10,
    reposts: (run.cumulativeReposts || 0) * 10,
    comments: (run.cumulativeComments || 0) * 10,
  }));
}

const SteppedTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const filtered = payload.filter(
    (entry: any) => !String(entry.name || "").startsWith("planned-")
  );

  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        background: "#000000",
        border: "1px solid #eab308",
        borderRadius: "0.75rem",
        color: "#d1d5db",
        fontSize: "12px",
        padding: "8px 12px",
      }}
    >
      <p style={{ marginBottom: 4, color: "#9ca3af" }}>{label}</p>
      {filtered.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color, margin: "2px 0" }}>
          {entry.name}: {Math.round(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function GrowthGraph({
  plan,
  selectedPreset,
  variancePercent = 40,
  delivery = { mode: "auto", hours: 18, label: "Auto" },
  includeLikes = false,
  includeShares = false,
  includeSaves = false,
  includeComments = false,
  includeReposts = false,
  peakHoursBoost = false,
  onApplyPreset,
  onGenerate,
  onApplyFavourite,
}: GrowthGraphProps) {
  const [graphMode, setGraphMode] = useState<GraphMode>("smooth");
  const [favourites, setFavourites] = useState<FavouriteConfig[]>(() => readFavourites());
  const [showFavourites, setShowFavourites] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [favouriteName, setFavouriteName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const safePlan = useMemo(
    () => ({ ...plan, runs: plan?.runs || [] }),
    [plan]
  );
  const smoothData = useMemo(() => buildSmoothGraphData(safePlan), [safePlan]);
  const steppedData = useMemo(() => buildSteppedGraphData(safePlan), [safePlan]);
  const curveType = lineTypeForPattern(safePlan.patternType);

    const handleSaveFavourite = () => {
    const name = favouriteName.trim() || `${safePlan.patternName} · ${safePlan.totalRuns} runs`;

    // 🔥 Calculate total quantities to derive fractions
    const savedTotalViews = safePlan.runs.reduce((sum, r) => sum + (r.views || 0), 0);
    const savedTotalLikes = safePlan.runs.reduce((sum, r) => sum + (r.likes || 0), 0);
    const savedTotalShares = safePlan.runs.reduce((sum, r) => sum + (r.shares || 0), 0);
    const savedTotalSaves = safePlan.runs.reduce((sum, r) => sum + (r.saves || 0), 0);
    const savedTotalComments = safePlan.runs.reduce((sum, r) => sum + (r.comments || 0), 0);
    const savedTotalReposts = safePlan.runs.reduce((sum, r) => sum + (r.reposts || 0), 0);

    // 🔥 Store each run as a fraction of total (so it scales to any view count)
    const runProportions = safePlan.runs.map((r) => ({
      minutesFromStart: r.minutesFromStart,
      viewsFraction: savedTotalViews > 0 ? (r.views || 0) / savedTotalViews : 0,
      likesFraction: savedTotalLikes > 0 ? (r.likes || 0) / savedTotalLikes : 0,
      sharesFraction: savedTotalShares > 0 ? (r.shares || 0) / savedTotalShares : 0,
      savesFraction: savedTotalSaves > 0 ? (r.saves || 0) / savedTotalSaves : 0,
      commentsFraction: savedTotalComments > 0 ? (r.comments || 0) / savedTotalComments : 0,
      repostsFraction: savedTotalReposts > 0 ? (r.reposts || 0) / savedTotalReposts : 0,
    }));

    const newFav: FavouriteConfig = {
      id: `fav-${Date.now()}`,
      savedAt: new Date().toISOString(),
      name,
      patternName: safePlan.patternName,
      patternType: safePlan.patternType,
      totalRuns: safePlan.totalRuns,
      estimatedDurationHours: safePlan.estimatedDurationHours,
      approximateIntervalMin: safePlan.approximateIntervalMin,
      finishTime: safePlan.finishTime instanceof Date ? safePlan.finishTime.toISOString() : new Date().toISOString(),
      risk: safePlan.risk,
      quickPreset: selectedPreset || null,
      variancePercent,
      delivery,
      includeLikes,
      includeShares,
      includeSaves,
      includeComments,
      includeReposts,
      peakHoursBoost,
      runProportions,
      savedTotalViews,
    };

    const updated = [newFav, ...favourites].slice(0, 10);
    setFavourites(updated);
    saveFavouritesToStorage(updated);
    setJustSaved(true);
    setShowNameInput(false);
    setFavouriteName("");
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDeleteFavourite = (id: string) => {
    const updated = favourites.filter((f) => f.id !== id);
    setFavourites(updated);
    saveFavouritesToStorage(updated);
  };

  return (
    <section className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-gray-900 to-black p-5">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-yellow-400">📈 Growth Projection</h2>

          <div className="inline-flex rounded-lg border border-yellow-500/30 bg-black p-0.5">
            <button
              type="button"
              onClick={() => setGraphMode("smooth")}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                graphMode === "smooth"
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-gray-500 hover:text-yellow-400"
              }`}
            >
              〰️ Smooth
            </button>
            <button
              type="button"
              onClick={() => setGraphMode("stepped")}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                graphMode === "stepped"
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-gray-500 hover:text-yellow-400"
              }`}
            >
              📊 Stepped
            </button>
          </div>

          {/* 🔥 Favourite controls — only in stepped mode */}
          {graphMode === "stepped" && (
            <div className="flex items-center gap-2">
              {showNameInput ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={favouriteName}
                    onChange={(e) => setFavouriteName(e.target.value)}
                    placeholder="Name this config..."
                    className="w-32 rounded-md border border-pink-500/30 bg-black px-2 py-0.5 text-[10px] text-white placeholder-gray-600 focus:border-pink-500/60 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveFavourite();
                      if (e.key === "Escape") {
                        setShowNameInput(false);
                        setFavouriteName("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveFavourite}
                    className="rounded-md border border-pink-500/40 bg-pink-500/20 px-2 py-0.5 text-[10px] text-pink-300 hover:bg-pink-500/30 transition"
                  >
                    ✓ Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNameInput(false);
                      setFavouriteName("");
                    }}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNameInput(true)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${
                    justSaved
                      ? "border-pink-500/60 bg-pink-500/20 text-pink-300 cursor-default"
                      : "border-pink-500/30 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 hover:border-pink-500/60"
                  }`}
                >
                  {justSaved ? "❤️ Saved!" : "🤍 Save Config"}
                </button>
              )}

              {favourites.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFavourites((prev) => !prev)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition ${
                    showFavourites
                      ? "border-pink-500/50 bg-pink-500/15 text-pink-300"
                      : "border-gray-700 text-gray-500 hover:text-pink-400"
                  }`}
                >
                  📋 {favourites.length} saved
                </button>
              )}
            </div>
          )}
        </div>

        {/* Preset Buttons */}
        {onApplyPreset && onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            {presetButtons.map((preset) => {
              const active = selectedPreset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onApplyPreset(preset.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    active
                      ? "border-yellow-500/70 bg-yellow-500/20 text-yellow-300"
                      : "border-gray-700 text-gray-500 hover:border-yellow-500/30 hover:text-yellow-400"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onGenerate}
              className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-300 transition hover:bg-yellow-500/20"
            >
              🔄 New Pattern
            </button>
          </div>
        )}
      </div>

      {/* 🔥 Favourites Panel */}
      {showFavourites && graphMode === "stepped" && favourites.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 rounded-xl border border-pink-500/20 bg-pink-500/5 p-3"
        >
          <h3 className="text-[10px] font-semibold text-pink-400 mb-2 uppercase tracking-wider">
            ❤️ Saved Configs ({favourites.length}/10)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {favourites.map((fav) => (
              <div
                key={fav.id}
                className="flex items-center justify-between rounded-lg border border-pink-500/20 bg-black/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-pink-300 truncate">
                    {fav.name}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[9px] text-gray-600">
                      {fav.delivery.label} · {fav.variancePercent}% var · {fav.risk}
                    </span>
                    {fav.quickPreset && (
                      <span className="rounded bg-yellow-500/20 px-1 py-0 text-[8px] text-yellow-400">
                        {fav.quickPreset}
                      </span>
                    )}
                    <span className="flex gap-0.5 text-[9px]">
                      {fav.includeLikes && <span title="Likes">❤️</span>}
                      {fav.includeShares && <span title="Shares">🔄</span>}
                      {fav.includeSaves && <span title="Saves">💾</span>}
                      {fav.includeComments && <span title="Comments">💬</span>}
                      {fav.includeReposts && <span title="Reposts">🔁</span>}
                      {fav.peakHoursBoost && <span title="Peak Hours">🔥</span>}
                    </span>
                    <span className="text-[9px] text-gray-700">
                      {new Date(fav.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {onApplyFavourite && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyFavourite(fav);
                        setShowFavourites(false);
                      }}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                      title="Apply this config to current order"
                    >
                      ▶️ Use
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteFavourite(fav.id)}
                    className="text-[10px] text-gray-600 hover:text-red-400 transition"
                    title="Remove"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-gray-600 mt-2">
            ℹ️ Configs are saved in your browser. Click ▶️ Use to apply settings to any view count. Max 10.
          </p>
        </motion.div>
      )}

      {/* Chart */}
      <motion.div
        key={`${safePlan.patternId}-${safePlan.totalRuns}-${graphMode}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="h-80"
      >
        {graphMode === "smooth" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={smoothData} margin={{ top: 14, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} minTickGap={26} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} width={52} />
              <Tooltip
                contentStyle={{
                  background: "#000000",
                  border: "1px solid #eab308",
                  borderRadius: "0.75rem",
                  color: "#d1d5db",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#d1d5db" }} />
              <Line type={curveType} dataKey="views" name="Views" stroke="#eab308" strokeWidth={2.5} dot={false} isAnimationActive animationDuration={900} />
              <Line type={curveType} dataKey="likes" name="Likes" stroke="#a78bfa" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={900} />
              <Line type={curveType} dataKey="shares" name="Shares" stroke="#f59e0b" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={900} />
              <Line type={curveType} dataKey="saves" name="Saves" stroke="#34d399" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={900} />
              <Line type={curveType} dataKey="reposts" name="Reposts" stroke="#06b6d4" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={900} />
              <Line type={curveType} dataKey="comments" name="Comments" stroke="#f472b6" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={steppedData} margin={{ top: 14, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111" opacity={0.3} />
              <XAxis dataKey="time" stroke="#666" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis stroke="#666" tick={{ fill: "#9ca3af", fontSize: 11 }} width={52} />
              <Tooltip content={<SteppedTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#d1d5db" }} />
              <Line type="monotone" dataKey="views" stroke="#3b82f6" opacity={0.1} dot={false} strokeDasharray="5 5" name="planned-views" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="likes" stroke="#ec4899" opacity={0.1} dot={false} strokeDasharray="5 5" name="planned-likes" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="shares" stroke="#22c55e" opacity={0.1} dot={false} strokeDasharray="5 5" name="planned-shares" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="saves" stroke="#eab308" opacity={0.1} dot={false} strokeDasharray="5 5" name="planned-saves" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="reposts" stroke="#06b6d4" opacity={0.1} dot={false} strokeDasharray="5 5" name="planned-reposts" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="comments" stroke="#a855f7" opacity={0.1} dot={false} strokeDasharray="5 5" name="planned-comments" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} name="Views" isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={2} dot={false} name="Likes" isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="shares" stroke="#22c55e" strokeWidth={2} dot={false} name="Shares" isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="saves" stroke="#eab308" strokeWidth={2} dot={false} name="Saves" isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="reposts" stroke="#06b6d4" strokeWidth={2} dot={false} name="Reposts" isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="comments" stroke="#a855f7" strokeWidth={2} dot={false} name="Comments" isAnimationActive animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[9px] text-gray-600">
          {graphMode === "smooth"
            ? "〰️ Smooth: Interpolated cumulative growth curve"
            : "📊 Stepped: Per-run cumulative view (same as Orders page)"}
        </p>
        {graphMode === "stepped" && (
          <p className="text-[9px] text-pink-600">
            🤍 Save config to reuse with any view count
          </p>
        )}
      </div>
    </section>
  );
}
