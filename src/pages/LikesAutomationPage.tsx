import { useMemo, useState } from "react";
import { createSmmOrder } from "../utils/api";
import type { ApiPanel, Bundle, CreatedOrder, RunStep } from "../types/order";
import { Button, Card, InfoBanner, Input, Select } from "../components/ui";

interface LikesAutomationPageProps {
  apis: ApiPanel[];
  bundles: Bundle[];
  onCreateOrder: (order: CreatedOrder) => void;
  onNavigateToOrders: (notice?: string) => void;
}

const asPositiveInteger = (value: string, fallback: number) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Give each run a different, natural-looking amount while preserving the exact total.
// Every run starts at the provider minimum; the remaining likes are distributed
// randomly. If the total equals minimum × runs, variation is mathematically impossible.
function splitQuantity(total: number, count: number, minimum: number, maximum: number) {
  const quantities = Array.from({ length: count }, () => minimum);
  let remaining = total - minimum * count;

  while (remaining > 0) {
    const eligible = quantities.map((quantity, index) => quantity < maximum ? index : -1).filter((index) => index >= 0);
    if (!eligible.length) break;
    const index = eligible[Math.floor(Math.random() * eligible.length)];
    const capacity = maximum - quantities[index];
    // Small random chunks make the result uneven rather than 10, 10, 10, 10.
    const chunk = Math.min(remaining, capacity, 1 + Math.floor(Math.random() * Math.min(8, remaining, capacity)));
    quantities[index] += chunk;
    remaining -= chunk;
  }

  return remaining === 0 ? quantities : [];
}

export function LikesAutomationPage({ apis, bundles, onCreateOrder, onNavigateToOrders }: LikesAutomationPageProps) {
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [totalLikes, setTotalLikes] = useState("1000");
  const [runCount, setRunCount] = useState("5");
  const [durationHours, setDurationHours] = useState("12");
  const [startDelayMinutes, setStartDelayMinutes] = useState("5");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableBundles = useMemo(
    () => bundles.filter((bundle) => {
      const api = apis.find((item) => item.id === bundle.apiId && item.status === "Active");
      return Boolean(api && String(bundle.serviceIds.likes || "").trim());
    }),
    [apis, bundles]
  );
  const selectedBundle = availableBundles.find((bundle) => bundle.id === bundleId);
  const selectedApi = selectedBundle ? apis.find((api) => api.id === selectedBundle.apiId) : undefined;
  const likesService = selectedApi?.services.find((service) => service.id === selectedBundle?.serviceIds.likes);

  const preview = useMemo(() => {
    const total = asPositiveInteger(totalLikes, 0);
    const desiredCount = asPositiveInteger(runCount, 1);
    const duration = asPositiveInteger(durationHours, 1);
    const serviceMin = Math.max(1, Math.floor(likesService?.min || 1));
    const serviceMax = Math.max(serviceMin, Math.floor(likesService?.max || total || serviceMin));
    const maxPossibleRuns = Math.floor(total / serviceMin);
    const count = Math.min(desiredCount, Math.max(1, maxPossibleRuns));
    const quantities = total >= serviceMin ? splitQuantity(total, count, serviceMin, serviceMax) : [];
    return { total, desiredCount, duration, serviceMin, serviceMax, count, quantities };
  }, [totalLikes, runCount, durationHours, likesService]);

  const createOrder = async () => {
    setError("");
    if (!link.trim()) return setError("Enter the post or profile link that should receive likes.");
    if (!selectedBundle || !selectedApi || !likesService) return setError("Select a bundle with a likes service from an active API.");
    if (preview.total < preview.serviceMin) return setError(`This likes service requires at least ${preview.serviceMin.toLocaleString()} likes per run.`);
    if (!preview.quantities.length) return setError(`This total cannot fit within the selected service maximum of ${preview.serviceMax.toLocaleString()} likes per run. Increase the number of runs or reduce the total.`);
    if (preview.quantities.some((quantity) => quantity > preview.serviceMax)) return setError(`Each run must be no more than ${preview.serviceMax.toLocaleString()} likes for this service. Increase the number of runs or reduce the total.`);
    if (preview.count !== preview.desiredCount) return setError(`The selected service minimum permits at most ${preview.count} runs for this total. Reduce runs or increase total likes.`);

    const startAt = Date.now() + asPositiveInteger(startDelayMinutes, 1) * 60_000;
    const intervalMs = preview.count <= 1 ? 0 : (preview.duration * 3_600_000) / (preview.count - 1);
    const runs: RunStep[] = preview.quantities.map((quantity, index) => {
      const at = new Date(startAt + intervalMs * index);
      const cumulativeLikes = preview.quantities.slice(0, index + 1).reduce((sum, value) => sum + value, 0);
      return {
        run: index + 1, at, minutesFromStart: Math.round((at.getTime() - startAt) / 60_000),
        views: 0, likes: quantity, shares: 0, saves: 0, comments: 0, reposts: 0,
        cumulativeViews: 0, cumulativeLikes, cumulativeShares: 0, cumulativeSaves: 0,
        cumulativeComments: 0, cumulativeReposts: 0,
      };
    });

    setSubmitting(true);
    try {
      const result = await createSmmOrder({
        name: name.trim() || "Likes automation",
        apiUrl: selectedApi.url,
        apiKey: selectedApi.key,
        link: link.trim(),
        services: { likes: { serviceId: likesService.id, runs: runs.map((run) => ({ time: run.at.toISOString(), quantity: run.likes })) } },
      });
      const now = new Date().toISOString();
      onCreateOrder({
        id: `LIKES-${Date.now().toString().slice(-8)}`,
        name: name.trim() || "Likes automation",
        schedulerOrderId: result.schedulerOrderId,
        smmOrderId: result.orderId || "Scheduled",
        link: link.trim(), totalViews: 0, startDelayHours: Number(startDelayMinutes) / 60,
        patternType: "steady-climb", patternName: "Likes-only scheduled delivery", runs,
        engagement: { likes: preview.total, shares: 0, saves: 0, comments: 0, reposts: 0 },
        serviceId: likesService.id, selectedAPI: selectedApi.name, selectedBundle: selectedBundle.name,
        status: result.status === "completed" ? "completed" : "running",
        completedRuns: result.completedRuns || 0, runStatuses: runs.map(() => "pending"),
        createdAt: now, lastUpdatedAt: now,
      });
      onNavigateToOrders(`Likes automation scheduled: ${preview.total.toLocaleString()} likes across ${preview.count} run${preview.count === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to schedule likes automation.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <div className="rounded-2xl bg-gradient-to-br from-pink-600 to-rose-600 p-6 text-white shadow-lg">
      <p className="text-sm font-semibold uppercase tracking-wider text-pink-100">Dedicated automation</p>
      <h1 className="mt-1 text-3xl font-bold">Likes Automation</h1>
      <p className="mt-2 max-w-2xl text-pink-50">Schedule likes-only delivery using the likes service configured in one of your bundles. No views or other engagement services are included.</p>
    </div>

    {error && <InfoBanner kind="danger">{error}</InfoBanner>}
    {availableBundles.length === 0 && <InfoBanner kind="warning">No active bundle with a likes service is available. Add an active API, fetch its services, then configure a bundle’s Likes service first.</InfoBanner>}

    <Card padding="md">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Campaign name (optional)" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Reel likes — July launch" /></div>
        <div className="sm:col-span-2"><Input label="Post or profile link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." /></div>
        <Select label="Bundle" value={bundleId} onChange={(event) => setBundleId(event.target.value)} options={[{ value: "", label: "Select a likes-enabled bundle" }, ...availableBundles.map((bundle) => ({ value: bundle.id, label: bundle.name }))]} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><p className="font-medium text-slate-700">Selected likes service</p><p className="mt-1 text-slate-500">{likesService ? `${likesService.name} · #${likesService.id}` : "Choose a bundle"}</p></div>
        <Input label="Total likes" type="number" min="1" value={totalLikes} onChange={(event) => setTotalLikes(event.target.value)} />
        <Input label="Number of scheduled runs" type="number" min="1" max="50" value={runCount} onChange={(event) => setRunCount(event.target.value)} />
        <Input label="Delivery duration (hours)" type="number" min="1" max="720" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} />
        <Input label="Start after (minutes)" type="number" min="1" value={startDelayMinutes} onChange={(event) => setStartDelayMinutes(event.target.value)} />
      </div>
    </Card>

    <Card padding="md">
      <h2 className="text-lg font-semibold text-slate-900">Schedule preview</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total likes', preview.total.toLocaleString()], ['Runs', String(preview.count)], ['Per run', preview.quantities.length ? `${Math.min(...preview.quantities).toLocaleString()}–${Math.max(...preview.quantities).toLocaleString()}` : '—'], ['Service minimum', preview.serviceMin.toLocaleString()]].map(([label, value]) => <div key={label} className="rounded-xl bg-pink-50 p-3"><p className="text-xs font-medium text-pink-700">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p></div>)}
      </div>
      <p className="mt-4 text-sm text-slate-500">Each run gets a randomized likes amount while keeping the exact total and respecting the provider minimum. The first run starts after the selected delay.</p>
      {preview.quantities.length > 0 && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><span className="font-medium">Planned likes: </span>{preview.quantities.join(", ")}</div>}
      <Button className="mt-5" variant="primary" size="lg" loading={submitting} disabled={!availableBundles.length} onClick={createOrder}>Schedule likes automation</Button>
    </Card>
  </div>;
}
