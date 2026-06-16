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

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeader
        eyebrow="Create campaign"
        title="New Order"
        description="Configure your delivery schedule, engagement mix, and target URL."
      />

      {ratiosAreCustom && (
        <InfoBanner kind="info" title="Custom engagement ratios active">
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
            <span>Likes {effectiveRatios.likes}%</span>
            <span>Shares {effectiveRatios.shares}%</span>
            <span>Saves {effectiveRatios.saves}%</span>
            <span>Comments {effectiveRatios.comments}%</span>
            <span>Reposts {effectiveRatios.reposts}%</span>
          </div>
          <p className="text-xs mt-1 opacity-75">Adjust in the Ratios page.</p>
        </InfoBanner>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ============ LEFT COLUMN ============ */}
        <div className="space-y-6">
          {/* Order details */}
          <Card padding="md">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Target details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Order name"
                  value={orderName}
                  onChange={(e) => setOrderName(e.target.value)}
                  placeholder="e.g. Spring campaign"
                />
                <Input
                  label="Total views"
                  type="number"
                  value={totalViews}
                  onChange={(e) => {
                    setUseClonedPlan(false);
                    const safeValue = Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0;
                    setTotalViews(Math.max(0, Math.floor(safeValue)));
                  }}
                />
              </div>
              <Input
                label="Post URL"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://instagram.com/reel/..."
              />
              <Textarea
                label="Bulk links"
                value={bulkLinks}
                onChange={(e) => setBulkLinks(e.target.value)}
                placeholder="Paste multiple URLs, one per line..."
                rows={3}
                hint={`${(bulkLinks.match(/\n/g)?.length ?? 0) + (bulkLinks ? 1 : 0)} link${(bulkLinks.match(/\n/g)?.length ?? 0) > 0 ? "s" : ""} detected`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="API panel"
                  value={selectedApiId}
                  onChange={(e) => { setSelectedApiId(e.target.value); setSelectedBundleId(""); }}
                  placeholder="Select API"
                  options={apis.map((api) => ({ value: api.id, label: api.name }))}
                />
                <Select
                  label="Bundle"
                  value={selectedBundleId}
                  onChange={(e) => setSelectedBundleId(e.target.value)}
                  placeholder="Select bundle"
                  options={bundleOptions.map((bundle) => ({ value: bundle.id, label: bundle.name }))}
                />
              </div>
            </div>
          </Card>

          {/* Run settings */}
          <Card padding="md">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Run settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">Minimum views per scheduled run</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-700">Minimum views / run</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minViewsPerRun}
                    onChange={(e) => handleMinViewsChange(Number(e.target.value))}
                    min={1}
                    max={10000}
                    className="w-24 text-right"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[100, 200, 300, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleMinViewsChange(preset)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      minViewsPerRun === preset
                        ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-slate-500">Estimated runs</p>
                  <p className="mt-1 text-lg font-bold text-indigo-700 tabular-nums">{estimatedRunCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avg views/run</p>
                  <p className="mt-1 text-lg font-bold text-indigo-700 tabular-nums">{averageViewsPerRun.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Max possible</p>
                  <p className="mt-1 text-lg font-bold text-slate-500 tabular-nums">{Math.floor(totalViews / minViewsPerRun)}</p>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Higher minimum = fewer runs with more views each. Lower = more gradual distribution.
              </p>
            </div>
          </Card>

          {/* Growth graph */}
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

          {/* Delivery controls */}
          <Card padding="md">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Delivery controls</h3>
            <div className="space-y-5">
              {/* Delivery time */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Delivery window</label>
                <div className="flex flex-wrap gap-2">
                  {deliveryOptions.map((option) => {
                    const isActive = delivery.label === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => { setUseClonedPlan(false); setDelivery(option); }}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {delivery.mode === "custom" && (
                  <div className="mt-3 flex items-center gap-2">
                    <Input
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
                      className="w-24"
                    />
                    <span className="text-xs text-slate-500">hours</span>
                  </div>
                )}
              </div>

              {/* Variance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Random variance</label>
                  <span className="text-sm font-semibold text-indigo-600 tabular-nums">{variancePercent}%</span>
                </div>
                <input
                  type="range"
                  value={variancePercent}
                  onChange={(e) => { setUseClonedPlan(false); setVariancePercent(Number(e.target.value)); }}
                  min={0}
                  max={50}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Smooth</span>
                  <span>Natural</span>
                </div>
              </div>

              {/* Start delay */}
              <Input
                label="Start delay (hours)"
                type="number"
                value={startDelayHours}
                onChange={(e) => {
                  setUseClonedPlan(false);
                  const safeValue = Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0;
                  setStartDelayHours(Math.max(0, Math.min(168, Math.floor(safeValue))));
                }}
                min={0}
                max={168}
                hint="Hours to wait before deployment"
              />

              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Engagement mix</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Likes", active: includeLikes, toggle: () => { setUseClonedPlan(false); setIncludeLikes(!includeLikes); }, color: "pink" },
                    { label: "Shares", active: includeShares, toggle: () => { setUseClonedPlan(false); setIncludeShares(!includeShares); }, color: "sky" },
                    { label: "Saves", active: includeSaves, toggle: () => { setUseClonedPlan(false); setIncludeSaves(!includeSaves); }, color: "violet" },
                    { label: "Reposts", active: includeReposts, toggle: () => { setUseClonedPlan(false); setIncludeReposts(!includeReposts); }, color: "cyan" },
                    { label: "Comments", active: includeComments, toggle: () => { setUseClonedPlan(false); setIncludeComments(!includeComments); }, color: "amber" },
                  ].map((btn) => (
                    <Toggle
                      key={btn.label}
                      label={btn.label}
                      checked={btn.active}
                      onChange={btn.toggle}
                    />
                  ))}
                  <Toggle
                    label="Peak hours"
                    description="Boost 6 PM - 11 PM"
                    checked={peakHoursBoost}
                    onChange={() => { setUseClonedPlan(false); setPeakHoursBoost(!peakHoursBoost); }}
                  />
                </div>
              </div>

              {includeComments && (
                <Textarea
                  label="Custom comments"
                  value={customComments}
                  onChange={(e) => setCustomComments(e.target.value)}
                  rows={3}
                  placeholder={"Nice post!\n🔥🔥\nAmazing content"}
                  hint="One comment per line"
                />
              )}
            </div>
          </Card>

          {/* Cost estimate */}
          {selectedBundleId && safePlan.runs.length > 0 && (
            <Card padding="md" className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Estimated cost</p>
                  <p className="text-xs text-slate-500 mt-0.5">Based on selected services</p>
                </div>
                {(() => {
                  const selBundle = bundles.find(b => b.id === selectedBundleId);
                  const selApi = apis.find(a => a.id === selectedApiId);
                  if (!selBundle || !selApi) return null;

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

                  return (
                    <p className="text-3xl font-bold text-indigo-700 tabular-nums">
                      ₹{total.toFixed(2)}
                    </p>
                  );
                })()}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Deploy button */}
      <Card padding="md" className="sticky bottom-4 z-10 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {createError ? (
              <div className="flex items-center gap-2 text-sm text-rose-600 truncate">
                <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{createError}</span>
              </div>
            ) : createSuccess ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 truncate">
                <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{createSuccess}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <StatusPill kind="info" dot={false}>
                  Ready
                </StatusPill>
                <span className="text-slate-500">
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
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
      </Card>
    </div>
  );
}
