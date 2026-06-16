import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GrowthGraph } from "../components/GrowthGraph";
import { PatternGenerator } from "../components/PatternGenerator";
import type {
  ApiPanel,
  Bundle,
  CreatedOrder,
  DeliveryOption,
  EngagementRatios,
  OrderConfig,
  PatternPlan,
  QuickPatternPreset,
} from "../types/order";
import { DEFAULT_ENGAGEMENT_RATIOS } from "../types/order";
import { createSmmOrder } from "../utils/api";
import { createPatternPlan } from "../utils/patterns";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Toggle,
  StatusPill,
  InfoBanner,
  SectionHeader,
} from "../components/ui";

interface NewOrderPageProps {
  apis: ApiPanel[];
  bundles: Bundle[];
  orders: CreatedOrder[];
  prefillOrder?: CreatedOrder | null;
  activeRatios?: EngagementRatios;
  onCreateOrder: (order: CreatedOrder) => void;
  onNavigateToOrders: (notice?: string) => void;
}

function createOrderId() {
  return `ORD-${Date.now().toString().slice(-6)}`;
}

/* ============================================ */
/* REUSABLE SUB-COMPONENTS                      */
/* ============================================ */

function SectionTitle({
  step,
  title,
  description,
  accent = "indigo",
}: {
  step: string;
  title: string;
  description: string;
  accent?: "indigo" | "emerald" | "amber" | "violet" | "rose";
}) {
  const accents = {
    indigo: { bg: "bg-indigo-600", text: "text-indigo-600", ring: "ring-indigo-200" },
    emerald: { bg: "bg-emerald-600", text: "text-emerald-600", ring: "ring-emerald-200" },
    amber: { bg: "bg-amber-600", text: "text-amber-600", ring: "ring-amber-200" },
    violet: { bg: "bg-violet-600", text: "text-violet-600", ring: "ring-violet-200" },
    rose: { bg: "bg-rose-600", text: "text-rose-600", ring: "ring-rose-200" },
  };
  const a = accents[accent];
  return (
    <div className="flex items-center gap-4 mb-5">
      <div className={`flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl ${a.bg} text-white text-lg sm:text-xl font-extrabold shadow-md`}>
        {step}
      </div>
      <div>
        <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${a.text}`}>{title}</h3>
        <p className="text-sm sm:text-base text-slate-600 font-medium mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ChipButton<T extends string>({
  options,
  active,
  onChange,
}: {
  options: Array<{ value: T; label: string; sublabel?: string }>;
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative rounded-xl px-3 py-3 text-sm font-bold transition-all ${
              isActive
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-300 scale-[1.02]"
                : "bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
            }`}
          >
            <span className="block">{opt.label}</span>
            {opt.sublabel && (
              <span className={`block text-xs font-semibold mt-0.5 ${isActive ? "text-indigo-100" : "text-slate-500"}`}>
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================ */
/* MAIN PAGE                                    */
/* ============================================ */

export function NewOrderPage({
  apis,
  bundles,
  orders,
  prefillOrder,
  activeRatios,
  onCreateOrder,
  onNavigateToOrders,
}: NewOrderPageProps) {
  const effectiveRatios = activeRatios ?? DEFAULT_ENGAGEMENT_RATIOS;
  const ratiosAreCustom =
    !!activeRatios &&
    (Object.keys(effectiveRatios) as (keyof EngagementRatios)[]).some(
      (k) => effectiveRatios[k] !== DEFAULT_ENGAGEMENT_RATIOS[k]
    );
  const prefillApiId = prefillOrder ? apis.find((api) => api.name === prefillOrder.selectedAPI)?.id ?? "" : "";
  const prefillBundleId = prefillOrder
    ? bundles.find((bundle) => bundle.name === prefillOrder.selectedBundle && bundle.apiId === prefillApiId)?.id ?? ""
    : "";
  const prefillRuns = prefillOrder?.runs || [];
  const prefillPlan: PatternPlan | null = prefillOrder
    ? {
        patternId: Number(prefillOrder.id.replace(/\D/g, "")) || Date.now() % 1000,
        patternName: prefillOrder.patternName,
        patternType: prefillOrder.patternType,
        totalRuns: prefillRuns.length,
        approximateIntervalMin:
          prefillRuns.length > 1
            ? Math.max(
                1,
                Math.round(
                  prefillRuns
                    .slice(1)
                    .reduce((acc, run, index) => {
                      const prev = prefillRuns[index];
                      return acc + (run.at.getTime() - prev.at.getTime()) / 60000;
                    }, 0) / (prefillRuns.length - 1)
                )
              )
            : 0,
        finishTime: prefillRuns[prefillRuns.length - 1]?.at ?? new Date(),
        estimatedDurationHours:
          prefillRuns.length > 1
            ? Math.round(
                ((prefillRuns[prefillRuns.length - 1]?.at.getTime() ?? Date.now()) -
                  (prefillRuns[0]?.at.getTime() ?? Date.now())) /
                  3600000
              )
            : 0,
        risk: "Safe",
        runs: prefillRuns,
      }
    : null;

  const [orderName, setOrderName] = useState(prefillOrder?.name && !prefillOrder.name.startsWith("Order #") ? prefillOrder.name : "");
  const [postUrl, setPostUrl] = useState(prefillOrder?.link ?? "");
  const [bulkLinks, setBulkLinks] = useState("");
  const [totalViews, setTotalViews] = useState(prefillOrder?.totalViews ?? 50000);
  const [selectedApiId, setSelectedApiId] = useState(prefillApiId);
  const [selectedBundleId, setSelectedBundleId] = useState(prefillBundleId);
  const [startDelayHours, setStartDelayHours] = useState(prefillOrder?.startDelayHours ?? 0);
  const [includeLikes, setIncludeLikes] = useState((prefillOrder?.engagement.likes ?? 0) > 0);
  const [includeShares, setIncludeShares] = useState((prefillOrder?.engagement.shares ?? 0) > 0);
  const [includeSaves, setIncludeSaves] = useState((prefillOrder?.engagement.saves ?? 0) > 0);
  const [includeReposts, setIncludeReposts] = useState((prefillOrder?.engagement.reposts ?? 0) > 0);
  const [customComments, setCustomComments] = useState("");
  const [includeComments, setIncludeComments] = useState(false);
  const [variancePercent, setVariancePercent] = useState(40);
  const [peakHoursBoost, setPeakHoursBoost] = useState(false);
  const [quickPreset, setQuickPreset] = useState<QuickPatternPreset | null>(null);
  const [customHours, setCustomHours] = useState(30);
  const [delivery, setDelivery] = useState<DeliveryOption>({ mode: "auto", hours: 18, label: "Auto" });
  const [seed, setSeed] = useState(0);
  const [useClonedPlan, setUseClonedPlan] = useState(Boolean(prefillPlan));
  const [clonedPlan] = useState<PatternPlan | null>(prefillPlan);
  const [expandedRuns, setExpandedRuns] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [minViewsPerRun, setMinViewsPerRun] = useState(100);

  useEffect(() => {
    const fetchMinViews = async () => {
      try {
        const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim().replace(/\/$/, "") || "https://truesmm-backend.onrender.com";
        const response = await fetch(`${backendUrl}/api/settings/min-views`);
        if (response.ok) {
          const data = await response.json();
          if (data.minViewsPerRun) {
            setMinViewsPerRun(data.minViewsPerRun);
          }
        }
      } catch (error) {
        console.warn("Could not fetch min views setting, using default 100");
      }
    };
    fetchMinViews();
  }, []);

  const selectedApi = apis.find(a => a.id === selectedApiId);
  const selectedBundle = bundles.find(b => b.id === selectedBundleId);

  const config: OrderConfig = useMemo(
    () => ({
      postUrl,
      totalViews,
      startDelayHours,
      includeLikes,
      includeShares,
      includeSaves,
      includeComments,
      includeReposts,
      variancePercent,
      peakHoursBoost,
      quickPreset,
      delivery:
        delivery.mode === "custom"
          ? { ...delivery, hours: customHours, label: "Custom" }
          : delivery.mode === "auto"
            ? { ...delivery, hours: Math.max(6, Math.min(48, delivery.hours)) }
            : delivery,
      minViewsPerRun,
      customRatios: ratiosAreCustom ? effectiveRatios : null,
    }),
    [
      postUrl, totalViews, startDelayHours, includeLikes, includeShares,
      includeSaves, includeComments, includeReposts, variancePercent, peakHoursBoost,
      quickPreset, delivery, customHours, minViewsPerRun,
      effectiveRatios, ratiosAreCustom,
    ]
  );

  const generatedPlan = useMemo(() => {
    try {
      const nextPlan = createPatternPlan(config);
      return { ...nextPlan, runs: nextPlan?.runs || [] };
    } catch (error) {
      console.error("Pattern plan generation failed", error);
      const now = new Date();
      return {
        patternId: 0,
        patternName: "fallback",
        patternType: "smooth-s-curve" as const,
        totalRuns: 0,
        approximateIntervalMin: 0,
        finishTime: now,
        estimatedDurationHours: 0,
        risk: "Safe" as const,
        runs: [],
      };
    }
  }, [config, seed]);

  const plan = useMemo(() => {
    const basePlan = useClonedPlan && clonedPlan
      ? { ...clonedPlan, runs: clonedPlan.runs || [] }
      : generatedPlan;

    const runs = basePlan?.runs || [];
    if (runs.length <= 1) return basePlan;

    const baseIntervalMin = basePlan.approximateIntervalMin || 120;

    const newRuns = runs.map((run, i) => {
      if (i === 0) return run;
      const prevTime = new Date(runs[i - 1].at).getTime();
      const hour = new Date(prevTime).getHours();
      let multiplier = 1;
      if (hour >= 0 && hour < 6) multiplier = 1.4;
      else if (hour >= 6 && hour < 12) multiplier = 1.1;
      else if (hour >= 18 && hour <= 23) multiplier = 0.85;
      const baseIntervalMs = baseIntervalMin * 60 * 1000 * multiplier;
      const variation = baseIntervalMs * (Math.random() * 0.4 - 0.2);
      const newTime = prevTime + baseIntervalMs + variation;
      return { ...run, at: new Date(newTime) };
    });

    return { ...basePlan, runs: newRuns };
  }, [useClonedPlan, clonedPlan, generatedPlan]);

  const safePlan = useMemo(() => ({ ...plan, runs: plan?.runs || [] }), [plan]);

  const bundleOptions = useMemo(() => {
    if (!selectedApiId) return bundles;
    return bundles.filter((bundle) => bundle.apiId === selectedApiId);
  }, [bundles, selectedApiId]);

  function isValidUrl(value: string) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  const handleApplyPreset = (preset: QuickPatternPreset) => {
    setUseClonedPlan(false);
    setQuickPreset(preset);
    if (preset === "viral-boost") { setVariancePercent(48); setDelivery({ mode: "preset", label: "12h", hours: 12 }); }
    if (preset === "fast-start") { setVariancePercent(32); setDelivery({ mode: "preset", label: "6h", hours: 6 }); }
    if (preset === "trending-push") { setVariancePercent(40); setDelivery({ mode: "preset", label: "24h", hours: 24 }); }
    if (preset === "slow-burn") { setVariancePercent(22); setDelivery({ mode: "preset", label: "48h", hours: 48 }); }
    setSeed((current) => current + 1);
    setExpandedRuns(true);
  };

  const handleGenerate = () => {
    setUseClonedPlan(false);
    setSeed((current) => current + 1);
    setExpandedRuns(true);
  };

  const handleMinViewsChange = (value: number) => {
    const newValue = Math.max(1, Math.floor(value));
    setMinViewsPerRun(newValue);
    setUseClonedPlan(false);
    setSeed((current) => current + 1);
    const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim().replace(/\/$/, "") || "https://truesmm-backend.onrender.com";
    fetch(`${backendUrl}/api/settings/min-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minViewsPerRun: newValue }),
    }).catch(() => console.warn("Could not update min views setting on backend"));
  };

  const deliveryOptions: DeliveryOption[] = [
    { mode: "preset", label: "6h", hours: 6 },
    { mode: "preset", label: "12h", hours: 12 },
    { mode: "auto", label: "Auto", hours: 18 },
    { mode: "preset", label: "24h", hours: 24 },
    { mode: "preset", label: "48h", hours: 48 },
    { mode: "custom", label: "Custom", hours: customHours },
  ];

  const estimatedRunCount = safePlan.runs.length;
  const averageViewsPerRun = estimatedRunCount > 0 ? Math.round(totalViews / estimatedRunCount) : 0;

  const totalCost = useMemo(() => {
    const selBundle = bundles.find(b => b.id === selectedBundleId);
    const selApi = apis.find(a => a.id === selectedApiId);
    if (!selBundle || !selApi || safePlan.runs.length === 0) return null;

    const viewsService = selApi.services.find(s => s.id === selBundle.serviceIds.views);
    const likesService = selApi.services.find(s => s.id === selBundle.serviceIds.likes);
    const sharesService = selApi.services.find(s => s.id === selBundle.serviceIds.shares);
    const savesService = selApi.services.find(s => s.id === selBundle.serviceIds.saves);
    const repostsService = selApi.services.find(s => s.id === selBundle.serviceIds.reposts);
    const commentsService = selApi.services.find(s => s.id === selBundle.serviceIds.comments);

    const totalViewsQty = safePlan.runs.reduce((sum, run) => sum + (run.views || 0), 0);
    const totalLikesQty = safePlan.runs.reduce((sum, run) => sum + (run.likes || 0), 0);
    const totalSharesQty = safePlan.runs.reduce((sum, run) => sum + (run.shares || 0), 0);
    const totalSavesQty = safePlan.runs.reduce((sum, run) => sum + (run.saves || 0), 0);
    const totalRepostsQty = safePlan.runs.reduce((sum, run) => sum + (run.reposts || 0), 0);
    const totalCommentsQty = safePlan.runs.reduce((sum, run) => sum + (run.comments || 0), 0);

    const viewsRate = parseFloat(viewsService?.rate || "0");
    const likesRate = parseFloat(likesService?.rate || "0");
    const sharesRate = parseFloat(sharesService?.rate || "0");
    const savesRate = parseFloat(savesService?.rate || "0");
    const repostsRate = parseFloat(repostsService?.rate || "0");
    const commentsRate = parseFloat(commentsService?.rate || "0");

    const viewsPrice = (totalViewsQty / 1000) * viewsRate;
    const likesPrice = includeLikes ? (totalLikesQty / 1000) * likesRate : 0;
    const sharesPrice = includeShares ? (totalSharesQty / 1000) * sharesRate : 0;
    const savesPrice = includeSaves ? (totalSavesQty / 1000) * savesRate : 0;
    const repostsPrice = includeReposts ? (totalRepostsQty / 1000) * repostsRate : 0;
    const commentsPrice = includeComments ? (totalCommentsQty / 1000) * commentsRate : 0;
    const total = viewsPrice + likesPrice + sharesPrice + savesPrice + repostsPrice + commentsPrice;

    return {
      total,
      views: viewsPrice,
      likes: likesPrice,
      shares: sharesPrice,
      saves: savesPrice,
      reposts: repostsPrice,
      comments: commentsPrice,
    };
  }, [selectedBundleId, selectedApiId, bundles, apis, safePlan.runs, includeLikes, includeShares, includeSaves, includeReposts, includeComments]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* ============ HERO HEADER ============ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-4 sm:p-5 shadow-lg shadow-indigo-500/20"
      >
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }} />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                Campaign builder
              </span>
              {ratiosAreCustom && (
                <span className="inline-flex items-center rounded-full bg-amber-400/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-50 backdrop-blur-sm">
                  Custom ratios
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Create a new mission
            </h1>
            <p className="mt-0.5 text-sm text-indigo-100 font-medium">
              Configure your delivery pattern, target URL, and engagement mix.
            </p>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 flex-shrink-0">
            {[
              { label: "Views", value: totalViews.toLocaleString() },
              { label: "Runs", value: estimatedRunCount.toString() },
              { label: "Duration", value: `${safePlan.estimatedDurationHours || 0}h` },
              { label: "Pattern", value: safePlan.patternName || "—" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-center min-w-[70px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">{stat.label}</p>
                <p className="mt-0.5 text-sm sm:text-base font-bold text-white tabular-nums truncate">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {ratiosAreCustom && (
        <InfoBanner kind="info" title="Custom engagement ratios are active">
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm font-semibold">
            <span>Likes {effectiveRatios.likes}%</span>
            <span>Shares {effectiveRatios.shares}%</span>
            <span>Saves {effectiveRatios.saves}%</span>
            <span>Comments {effectiveRatios.comments}%</span>
            <span>Reposts {effectiveRatios.reposts}%</span>
          </div>
          <p className="text-sm font-medium mt-1 opacity-75">Adjust in the Ratios page.</p>
        </InfoBanner>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ============ LEFT COLUMN ============ */}
        <div className="space-y-6">
          {/* Step 1: Target details */}
          <Card padding="lg" className="border-2 border-slate-200 shadow-md">
            <SectionTitle step="1" title="Target details" description="Where should we deliver your engagement?" accent="indigo" />
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-2">
                    Order name
                  </label>
                  <input
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    placeholder="e.g. Spring campaign"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-2">
                    Total views
                  </label>
                  <input
                    type="number"
                    value={totalViews}
                    onChange={(e) => {
                      setUseClonedPlan(false);
                      const safeValue = Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0;
                      setTotalViews(Math.max(0, Math.floor(safeValue)));
                    }}
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 tabular-nums focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800 mb-2">
                  Post URL
                </label>
                <input
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://instagram.com/reel/..."
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800 mb-2">
                  Bulk links{" "}
                  <span className="text-sm font-medium text-slate-500">(one per line)</span>
                </label>
                <textarea
                  value={bulkLinks}
                  onChange={(e) => setBulkLinks(e.target.value)}
                  rows={4}
                  placeholder="Paste multiple URLs here..."
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none resize-none transition"
                />
                {bulkLinks && (
                  <p className="mt-2 text-sm font-semibold text-indigo-600">
                    {(bulkLinks.match(/\n/g)?.length ?? 0) + 1} link{(bulkLinks.match(/\n/g)?.length ?? 0) > 0 ? "s" : ""} detected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-2">
                    API panel
                  </label>
                  <select
                    value={selectedApiId}
                    onChange={(e) => { setSelectedApiId(e.target.value); setSelectedBundleId(""); }}
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                  >
                    <option value="">Select API…</option>
                    {apis.map((api) => (
                      <option key={api.id} value={api.id}>{api.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-2">
                    Bundle
                  </label>
                  <select
                    value={selectedBundleId}
                    onChange={(e) => setSelectedBundleId(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                  >
                    <option value="">Select bundle…</option>
                    {bundleOptions.map((bundle) => (
                      <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 2: Run settings */}
          <Card padding="lg" className="border-2 border-violet-200 shadow-md">
            <SectionTitle step="2" title="Run settings" description="How many views per scheduled run?" accent="violet" />

            <div className="rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-100 p-5 mb-5">
              <label className="block text-base font-bold text-slate-800 mb-3">
                Minimum views per run
              </label>
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="number"
                  value={minViewsPerRun}
                  onChange={(e) => handleMinViewsChange(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-32 text-right rounded-xl border-2 border-violet-200 bg-white px-4 py-3 text-xl font-extrabold text-violet-700 tabular-nums focus:border-violet-500 focus:ring-4 focus:ring-violet-100 focus:outline-none transition"
                />
                <span className="text-base font-bold text-slate-600">views / run</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {[100, 200, 300, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleMinViewsChange(preset)}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                      minViewsPerRun === preset
                        ? "bg-violet-600 text-white shadow-md scale-105"
                        : "bg-white border-2 border-violet-200 text-violet-700 hover:bg-violet-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white border-2 border-slate-200 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Runs</p>
                <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-violet-600 tabular-nums">{estimatedRunCount}</p>
              </div>
              <div className="rounded-xl bg-white border-2 border-slate-200 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg / run</p>
                <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-violet-600 tabular-nums">{averageViewsPerRun.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-white border-2 border-slate-200 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Max</p>
                <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-400 tabular-nums">{Math.floor(totalViews / minViewsPerRun)}</p>
              </div>
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-600">
              💡 Higher minimum = fewer runs with more views each.
            </p>
          </Card>

          {/* Step 3: Growth graph */}
          <GrowthGraph
            plan={safePlan}
            selectedPreset={quickPreset}
            includeReposts={includeReposts}
            onApplyPreset={handleApplyPreset}
            onGenerate={handleGenerate}
          />
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="space-y-6">
          {/* Schedule preview */}
          <PatternGenerator
            plan={safePlan}
            expandedRuns={expandedRuns}
            onToggleRuns={() => setExpandedRuns((prev) => !prev)}
          />

          {/* Step 4: Delivery window */}
          <Card padding="lg" className="border-2 border-emerald-200 shadow-md">
            <SectionTitle step="3" title="Delivery window" description="Choose how fast to spread the runs" accent="emerald" />

            <div className="space-y-5">
              <div>
                <label className="block text-base font-bold text-slate-800 mb-3">
                  Delivery speed
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {deliveryOptions.map((option) => {
                    const isActive = delivery.label === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => { setUseClonedPlan(false); setDelivery(option); }}
                        className={`rounded-xl px-3 py-3 text-base font-bold transition-all ${
                          isActive
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300 scale-[1.02]"
                            : "bg-white border-2 border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                        }`}
                      >
                        <span className="block">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                {delivery.mode === "custom" && (
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      value={customHours}
                      onChange={(e) => {
                        setUseClonedPlan(false);
                        const safeHours = Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 1;
                        const clampedHours = Math.max(1, Math.min(96, safeHours));
                        setCustomHours(clampedHours);
                        setDelivery({ mode: "custom", label: "Custom", hours: clampedHours });
                      }}
                      min={1}
                      max={96}
                      className="w-28 rounded-xl border-2 border-emerald-200 bg-white px-4 py-2.5 text-lg font-extrabold text-emerald-700 tabular-nums focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 focus:outline-none transition"
                    />
                    <span className="text-base font-bold text-slate-600">hours</span>
                  </div>
                )}
              </div>

              {/* Variance */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-base font-bold text-slate-800">
                    Random variance
                  </label>
                  <span className="rounded-lg bg-indigo-100 px-3 py-1 text-xl font-extrabold text-indigo-700 tabular-nums">
                    {variancePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  value={variancePercent}
                  onChange={(e) => { setUseClonedPlan(false); setVariancePercent(Number(e.target.value)); }}
                  min={0}
                  max={50}
                  className="w-full"
                />
                <div className="flex justify-between text-sm font-semibold text-slate-500 mt-2">
                  <span>Smooth</span>
                  <span>Natural</span>
                </div>
              </div>

              {/* Start delay */}
              <div>
                <label className="block text-base font-bold text-slate-800 mb-2">
                  Start delay (hours)
                </label>
                <input
                  type="number"
                  value={startDelayHours}
                  onChange={(e) => {
                    setUseClonedPlan(false);
                    const safeValue = Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0;
                    setStartDelayHours(Math.max(0, Math.min(168, Math.floor(safeValue))));
                  }}
                  min={0}
                  max={168}
                  className="w-40 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 tabular-nums focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 focus:outline-none transition"
                />
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Hours to wait before deployment starts
                </p>
              </div>
            </div>
          </Card>

          {/* Step 5: Engagement */}
          <Card padding="lg" className="border-2 border-pink-200 shadow-md">
            <SectionTitle step="4" title="Engagement mix" description="Toggle the engagement types you need" accent="amber" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Likes", description: "Heart reactions", active: includeLikes, toggle: () => { setUseClonedPlan(false); setIncludeLikes(!includeLikes); }, color: "pink", emoji: "❤️" },
                { label: "Shares", description: "Forward to friends", active: includeShares, toggle: () => { setUseClonedPlan(false); setIncludeShares(!includeShares); }, color: "sky", emoji: "🔁" },
                { label: "Saves", description: "Bookmark posts", active: includeSaves, toggle: () => { setUseClonedPlan(false); setIncludeSaves(!includeSaves); }, color: "violet", emoji: "🔖" },
                { label: "Reposts", description: "Share to feed", active: includeReposts, toggle: () => { setUseClonedPlan(false); setIncludeReposts(!includeReposts); }, color: "cyan", emoji: "📢" },
                { label: "Comments", description: "Custom text", active: includeComments, toggle: () => { setUseClonedPlan(false); setIncludeComments(!includeComments); }, color: "amber", emoji: "💬" },
              ].map((btn) => {
                const tones: Record<string, { bg: string; text: string; ring: string }> = {
                  pink: { bg: "bg-pink-600", text: "text-pink-700", ring: "ring-pink-300" },
                  sky: { bg: "bg-sky-600", text: "text-sky-700", ring: "ring-sky-300" },
                  violet: { bg: "bg-violet-600", text: "text-violet-700", ring: "ring-violet-300" },
                  cyan: { bg: "bg-cyan-600", text: "text-cyan-700", ring: "ring-cyan-300" },
                  amber: { bg: "bg-amber-600", text: "text-amber-700", ring: "ring-amber-300" },
                };
                const t = tones[btn.color];
                return (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={btn.toggle}
                    className={`flex items-center justify-between gap-3 rounded-xl p-4 text-left transition-all ${
                      btn.active
                        ? `${t.bg} text-white shadow-lg ring-2 ${t.ring} scale-[1.01]`
                        : "bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{btn.emoji}</span>
                        <p className={`text-base font-bold ${btn.active ? "text-white" : "text-slate-900"}`}>
                          {btn.label}
                        </p>
                      </div>
                      <p className={`text-sm font-medium mt-0.5 ${btn.active ? "text-white/80" : "text-slate-500"}`}>
                        {btn.description}
                      </p>
                    </div>
                    <div className={`flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${btn.active ? "bg-white/30" : "bg-slate-300"}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${btn.active ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </button>
                );
              })}

              {/* Peak hours toggle - special styling */}
              <button
                type="button"
                onClick={() => { setUseClonedPlan(false); setPeakHoursBoost(!peakHoursBoost); }}
                className={`flex items-center justify-between gap-3 rounded-xl p-4 text-left transition-all col-span-1 sm:col-span-2 ${
                  peakHoursBoost
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg ring-2 ring-orange-300"
                    : "bg-white border-2 border-slate-200 text-slate-700 hover:border-orange-300"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔥</span>
                    <p className={`text-base font-bold ${peakHoursBoost ? "text-white" : "text-slate-900"}`}>
                      Peak hours boost
                    </p>
                  </div>
                  <p className={`text-sm font-medium mt-0.5 ${peakHoursBoost ? "text-white/80" : "text-slate-500"}`}>
                    Amplify delivery 6 PM - 11 PM
                  </p>
                </div>
                <div className={`flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${peakHoursBoost ? "bg-white/30" : "bg-slate-300"}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${peakHoursBoost ? "translate-x-6" : "translate-x-1"}`} />
                </div>
              </button>
            </div>

            {includeComments && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-5"
              >
                <label className="block text-base font-bold text-slate-800 mb-2">
                  Custom comments{" "}
                  <span className="text-sm font-medium text-slate-500">(one per line)</span>
                </label>
                <textarea
                  value={customComments}
                  onChange={(e) => setCustomComments(e.target.value)}
                  rows={4}
                  placeholder={"Nice post!\n🔥🔥\nAmazing"}
                  className="w-full rounded-xl border-2 border-amber-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none resize-none transition"
                />
              </motion.div>
            )}
          </Card>

          {/* Cost estimate - hero style */}
          {totalCost && totalCost.total > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 sm:p-7 shadow-xl shadow-indigo-500/30"
            >
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }} />
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

              <div className="relative">
                <p className="text-sm sm:text-base font-bold uppercase tracking-wider text-indigo-100">
                  💰 Estimated cost
                </p>
                <p className="mt-2 text-5xl sm:text-6xl font-extrabold text-white tabular-nums tracking-tight">
                  ₹{totalCost.total.toFixed(2)}
                </p>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {totalCost.views > 0 && (
                    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/20">
                      <span className="text-indigo-100 font-bold">Views</span>
                      <span className="ml-2 text-white font-extrabold tabular-nums">₹{totalCost.views.toFixed(2)}</span>
                    </div>
                  )}
                  {includeLikes && totalCost.likes > 0 && (
                    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/20">
                      <span className="text-pink-100 font-bold">Likes</span>
                      <span className="ml-2 text-white font-extrabold tabular-nums">₹{totalCost.likes.toFixed(2)}</span>
                    </div>
                  )}
                  {includeShares && totalCost.shares > 0 && (
                    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/20">
                      <span className="text-sky-100 font-bold">Shares</span>
                      <span className="ml-2 text-white font-extrabold tabular-nums">₹{totalCost.shares.toFixed(2)}</span>
                    </div>
                  )}
                  {includeSaves && totalCost.saves > 0 && (
                    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/20">
                      <span className="text-violet-100 font-bold">Saves</span>
                      <span className="ml-2 text-white font-extrabold tabular-nums">₹{totalCost.saves.toFixed(2)}</span>
                    </div>
                  )}
                  {includeReposts && totalCost.reposts > 0 && (
                    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/20">
                      <span className="text-cyan-100 font-bold">Reposts</span>
                      <span className="ml-2 text-white font-extrabold tabular-nums">₹{totalCost.reposts.toFixed(2)}</span>
                    </div>
                  )}
                  {includeComments && totalCost.comments > 0 && (
                    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/20">
                      <span className="text-amber-100 font-bold">Comments</span>
                      <span className="ml-2 text-white font-extrabold tabular-nums">₹{totalCost.comments.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ============ DEPLOY BAR ============ */}
      <div className="sticky bottom-4 z-10">
        <div className="rounded-2xl border-2 border-indigo-200 bg-white/95 backdrop-blur-md shadow-2xl shadow-indigo-500/20 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {createError ? (
                <div className="flex items-center gap-2 text-base font-semibold text-rose-700 truncate">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold">!</span>
                  <span className="truncate">{createError}</span>
                </div>
              ) : createSuccess ? (
                <div className="flex items-center gap-2 text-base font-semibold text-emerald-700 truncate">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold">✓</span>
                  <span className="truncate">{createSuccess}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1.5 text-sm font-bold text-indigo-700">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    Ready to deploy
                  </span>
                  <span className="text-sm font-bold text-slate-700 tabular-nums">
                    {estimatedRunCount} runs · ~{averageViewsPerRun.toLocaleString()} views/run
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              size="lg"
              loading={isCreatingOrder}
              disabled={isCreatingOrder}
              className="text-base font-extrabold shadow-lg shadow-indigo-500/40"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              onClick={async () => {
                setCreateError("");
                setCreateSuccess("");
                if (!selectedBundleId) { setCreateError("Select a bundle before creating a mission."); return; }
                const bulkTargets = bulkLinks.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                const singleTarget = postUrl.trim();
                const targets = bulkTargets.length > 0 ? bulkTargets : singleTarget ? [singleTarget] : [];
                if (!targets.length) { setCreateError("Add a post URL or paste multiple links."); return; }
                const invalidTarget = targets.find((target) => !isValidUrl(target));
                if (invalidTarget) { setCreateError(`Invalid URL: ${invalidTarget.slice(0, 30)}...`); return; }

                const selApi = apis.find((api) => api.id === selectedApiId) ?? null;
                if (!selApi) { setCreateError("Select an API."); return; }
                if (!selApi.url.trim()) { setCreateError("API URL is required."); return; }
                if (!isValidUrl(selApi.url.trim())) { setCreateError("API URL must be valid."); return; }
                if (!selApi.key.trim()) { setCreateError("API key is required."); return; }

                const selBundle = bundles.find((bundle) => bundle.id === selectedBundleId);
                if (!selBundle) { setCreateError("Select a valid bundle."); return; }
                const viewsServiceId = selBundle.serviceIds.views.trim();
                if (!viewsServiceId) { setCreateError("Bundle has no Views service."); return; }
                const likesServiceId = selBundle.serviceIds.likes.trim();
                const sharesServiceId = selBundle.serviceIds.shares.trim();
                const savesServiceId = selBundle.serviceIds.saves.trim();
                const repostsServiceId = selBundle.serviceIds.reposts?.trim();
                if (includeLikes && !likesServiceId) { setCreateError("Bundle has no Likes service."); return; }
                if (includeShares && !sharesServiceId) { setCreateError("Bundle has no Shares service."); return; }
                if (includeSaves && !savesServiceId) { setCreateError("Bundle has no Saves service."); return; }
                if (includeReposts && !repostsServiceId) { setCreateError("Bundle has no Reposts service."); return; }
                const commentsServiceId = selBundle.serviceIds.comments?.trim();
                if (includeComments && !commentsServiceId) { setCreateError("Bundle has no Comments service."); return; }

                const quantity = (safePlan?.runs || []).reduce((acc, run) => acc + run.views, 0);
                if (!Number.isFinite(quantity) || quantity <= 0) { setCreateError("Quantity must be > 0."); return; }
                if (quantity < minViewsPerRun) { setCreateError(`Views must be at least ${minViewsPerRun}.`); return; }

                const totalLikes = (safePlan?.runs || []).reduce((acc, run) => acc + run.likes, 0);
                const totalShares = (safePlan?.runs || []).reduce((acc, run) => acc + run.shares, 0);
                const totalSaves = (safePlan?.runs || []).reduce((acc, run) => acc + run.saves, 0);
                const totalReposts = (safePlan?.runs || []).reduce((acc, run) => acc + (run.reposts || 0), 0);
                const totalCommentsQty = (safePlan?.runs || []).reduce((acc, run) => acc + (run.comments || 0), 0);

                if (includeLikes && totalLikes < 10) { setCreateError("Likes must be at least 10."); return; }
                if (includeShares && totalShares < 20) { setCreateError("Shares must be at least 20."); return; }
                if (includeSaves && totalSaves < 10) { setCreateError("Saves must be at least 10."); return; }
                if (includeReposts && totalReposts < 10) { setCreateError("Reposts must be at least 10."); return; }
                if (includeComments && totalCommentsQty <= 0) { setCreateError("Comments must be greater than 0."); return; }
                if (quantity > 100000) { const proceed = window.confirm("Large mission. Continue?"); if (!proceed) return; }

                const viewRuns = (safePlan?.runs || []).map((run) => ({
                  time: run.at.toISOString(),
                  quantity: Math.max(Math.floor(run.views), minViewsPerRun),
                }));
                if (!viewRuns.length || viewRuns.some((run) => !run.time || !Number.isFinite(run.quantity) || run.quantity <= 0)) {
                  setCreateError("Invalid run schedule. Regenerate."); return;
                }

                const likesRuns = (safePlan?.runs || []).map((run) => ({ time: run.at.toISOString(), quantity: Math.max(0, Math.floor(run.likes)) }));
                const sharesRuns = (safePlan?.runs || []).map((run) => ({ time: run.at.toISOString(), quantity: Math.max(0, Math.floor(run.shares)) }));
                const savesRuns = (safePlan?.runs || []).map((run) => ({ time: run.at.toISOString(), quantity: Math.max(0, Math.floor(run.saves)) }));
                const repostsRuns = (safePlan?.runs || []).map((run) => ({ time: run.at.toISOString(), quantity: Math.max(0, Math.floor(run.reposts || 0)) }));

                const commentList = customComments.split("\n").map(c => c.trim()).filter(Boolean);
                const commentsRuns = (safePlan?.runs || []).map((run) => {
                  const required = Math.floor(run.comments || 0);
                  if (required <= 0) return { time: run.at.toISOString(), comments: "" };
                  let finalComments: string[] = [];
                  if (commentList.length === 0) { finalComments = ["Nice post"]; }
                  else if (commentList.length >= required) { finalComments = commentList.slice(0, required); }
                  else { while (finalComments.length < required) { finalComments.push(commentList[finalComments.length % commentList.length]); } }
                  return { time: run.at.toISOString(), comments: finalComments.join("\n") };
                });
                const filteredCommentsRuns = commentsRuns.filter(run => run.comments && run.comments.length > 0);

                const servicesPayload: {
                  views: { serviceId: string; runs: Array<{ time: string; quantity: number }> };
                  likes?: { serviceId: string; runs: Array<{ time: string; quantity: number }> };
                  shares?: { serviceId: string; runs: Array<{ time: string; quantity: number }> };
                  saves?: { serviceId: string; runs: Array<{ time: string; quantity: number }> };
                  reposts?: { serviceId: string; runs: Array<{ time: string; quantity: number }> };
                  comments?: { serviceId: string; runs: Array<{ time: string; comments: string }> };
                } = { views: { serviceId: viewsServiceId, runs: viewRuns } };

                if (includeLikes) servicesPayload.likes = { serviceId: likesServiceId, runs: likesRuns };
                if (includeShares) servicesPayload.shares = { serviceId: sharesServiceId, runs: sharesRuns };
                if (includeSaves) servicesPayload.saves = { serviceId: savesServiceId, runs: savesRuns };
                if (includeReposts) servicesPayload.reposts = { serviceId: repostsServiceId!, runs: repostsRuns };
                if (includeComments && filteredCommentsRuns.length > 0) {
                  servicesPayload.comments = { serviceId: commentsServiceId!, runs: filteredCommentsRuns };
                }

                setIsCreatingOrder(true);
                setCreateSuccess(`Processing ${targets.length} mission${targets.length > 1 ? "s" : ""}...`);

                const batchId = targets.length > 1 ? `batch-${Date.now()}` : undefined;

                try {
                  const activeLinks = new Set(
                    orders.filter((order) => {
                      const now = Date.now();
                      const runs = order.runs || [];
                      if (!runs.length) return false;
                      const allRunsCompleted = runs.every((run) => new Date(run.at).getTime() <= now);
                      return !allRunsCompleted && order.status !== "cancelled" && order.status !== "failed" && order.status !== "completed";
                    }).map((order) => order.link.replace(/\/+$/, "").toLowerCase())
                  );
                  const createdLinks = new Set<string>();
                  let successCount = 0;
                  let failedCount = 0;
                  let lastError = "";

                  for (let index = 0; index < targets.length; index += 1) {
                    const trimmedUrl = targets[index];
                    const normalizedTarget = trimmedUrl.replace(/\/+$/, "").toLowerCase();
                    if (activeLinks.has(normalizedTarget) || createdLinks.has(normalizedTarget)) {
                      failedCount += 1; lastError = "Duplicate link."; continue;
                    }

                    try {
                      const result = await createSmmOrder({
                        name: orderName.trim() || undefined,
                        apiUrl: selApi.url,
                        apiKey: selApi.key,
                        link: trimmedUrl,
                        services: servicesPayload,
                      });

                      const order: CreatedOrder = {
                        id: createOrderId(),
                        name: orderName.trim() || `Mission #${createOrderId()}`,
                        batchId,
                        batchIndex: index + 1,
                        batchTotal: targets.length,
                        schedulerOrderId: result.schedulerOrderId,
                        smmOrderId: result.orderId ?? "Scheduled",
                        link: trimmedUrl,
                        totalViews: quantity,
                        startDelayHours,
                        patternType: safePlan.patternType,
                        patternName: safePlan.patternName,
                        runs: safePlan?.runs || [],
                        engagement: { likes: totalLikes, shares: totalShares, saves: totalSaves, comments: totalCommentsQty, reposts: totalReposts },
                        serviceId: viewsServiceId,
                        selectedAPI: selApi.name,
                        selectedBundle: selBundle.name,
                        status: result.status === "completed" ? "completed" : "running",
                        completedRuns: typeof result.completedRuns === "number" ? result.completedRuns : 0,
                        runStatuses: (safePlan?.runs || []).map(() => "pending"),
                        createdAt: new Date().toISOString(),
                        lastUpdatedAt: new Date().toISOString(),
                      };

                      onCreateOrder(order);
                      createdLinks.add(normalizedTarget);
                      successCount += 1;
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Failed";
                      const failedOrder: CreatedOrder = {
                        id: createOrderId(),
                        name: orderName.trim() || `Mission #${createOrderId()}`,
                        batchId,
                        batchIndex: index + 1,
                        batchTotal: targets.length,
                        smmOrderId: "N/A",
                        link: trimmedUrl,
                        totalViews: quantity,
                        startDelayHours,
                        patternType: safePlan.patternType,
                        patternName: safePlan.patternName,
                        runs: safePlan?.runs || [],
                        engagement: { likes: totalLikes, shares: totalShares, saves: totalSaves, comments: totalCommentsQty, reposts: totalReposts },
                        serviceId: viewsServiceId,
                        selectedAPI: selApi.name,
                        selectedBundle: selBundle.name,
                        status: "failed",
                        completedRuns: 0,
                        runStatuses: (safePlan?.runs || []).map((_, i) => (i === 0 ? "cancelled" : "pending")),
                        runErrors: (safePlan?.runs || []).map((_, i) => (i === 0 ? message : "")),
                        errorMessage: message,
                        createdAt: new Date().toISOString(),
                        lastUpdatedAt: new Date().toISOString(),
                      };
                      onCreateOrder(failedOrder);
                      failedCount += 1;
                      lastError = message;
                    }
                  }

                  if (failedCount > 0 && successCount === 0) {
                    setCreateError(lastError || "Failed.");
                    setCreateSuccess("");
                    return;
                  }

                  const successLabel = targets.length > 1 ? `Done: ${successCount}/${targets.length}` : "Mission deployed";
                  setCreateSuccess(successLabel);
                  if (failedCount > 0) setCreateError(`${failedCount} failed`);
                  onNavigateToOrders(successLabel);
                } finally {
                  setIsCreatingOrder(false);
                }
              }}
            >
              {isCreatingOrder ? "Deploying..." : "Deploy mission"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
