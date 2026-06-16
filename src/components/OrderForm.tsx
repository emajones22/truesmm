import type { DeliveryOption } from "../types/order";
import { Card, Input, Select, Textarea, Toggle } from "./ui";

interface OrderFormProps {
  orderName: string;
  postUrl: string;
  bulkLinks: string;
  totalViews: number;
  selectedApiId: string;
  selectedBundleId: string;
  apiOptions: Array<{ id: string; name: string }>;
  bundleOptions: Array<{ id: string; name: string }>;
  startDelayHours: number;
  variancePercent: number;
  includeLikes: boolean;
  includeShares: boolean;
  includeSaves: boolean;
  includeComments: boolean;
  peakHoursBoost: boolean;
  delivery: DeliveryOption;
  customHours: number;
  onPostUrlChange: (value: string) => void;
  onBulkLinksChange: (value: string) => void;
  onOrderNameChange: (value: string) => void;
  onTotalViewsChange: (value: number) => void;
  onSelectedApiChange: (value: string) => void;
  onSelectedBundleChange: (value: string) => void;
  onStartDelayHoursChange: (value: number) => void;
  onVarianceChange: (value: number) => void;
  onToggleLikes: (value: boolean) => void;
  onToggleShares: (value: boolean) => void;
  onToggleSaves: (value: boolean) => void;
  onToggleComments: (value: boolean) => void;
  onPeakHoursChange: (value: boolean) => void;
  onDeliveryChange: (option: DeliveryOption) => void;
  onCustomHoursChange: (hours: number) => void;
}

export function OrderForm(props: OrderFormProps) {
  const deliveryModes: DeliveryOption[] = [
    { mode: "auto", label: "Auto", hours: props.delivery.mode === "auto" ? props.delivery.hours : 18 },
    { mode: "preset", label: "6h", hours: 6 },
    { mode: "preset", label: "12h", hours: 12 },
    { mode: "preset", label: "24h", hours: 24 },
    { mode: "preset", label: "48h", hours: 48 },
    { mode: "custom", label: "Custom", hours: props.customHours },
  ];

  return (
    <div className="space-y-6">
      <Card padding="md">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Target</h2>
        <div className="space-y-4">
          <Input
            label="Mission name (optional)"
            value={props.orderName}
            onChange={(event) => props.onOrderNameChange(event.target.value)}
            placeholder="Campaign name"
          />
          <Input
            label="Target URL"
            value={props.postUrl}
            onChange={(event) => props.onPostUrlChange(event.target.value)}
            placeholder="https://instagram.com/reel/..."
          />
          <Textarea
            label="Bulk targets"
            value={props.bulkLinks}
            onChange={(event) => props.onBulkLinksChange(event.target.value)}
            rows={4}
            placeholder={"https://instagram.com/reel/abc...\nhttps://instagram.com/reel/xyz..."}
            hint="One URL per line"
          />
          <Input
            label="Total views"
            type="number"
            value={props.totalViews}
            onChange={(event) => {
              const next = Number(event.target.value);
              props.onTotalViewsChange(Number.isFinite(next) ? next : 0);
            }}
            hint="Minimum 100 views per run applied automatically"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="API"
              value={props.selectedApiId}
              onChange={(event) => props.onSelectedApiChange(event.target.value)}
              options={props.apiOptions}
              placeholder="No API selected"
            />
            <Select
              label="Bundle"
              value={props.selectedBundleId}
              onChange={(event) => props.onSelectedBundleChange(event.target.value)}
              options={props.bundleOptions}
              placeholder="Select bundle"
            />
          </div>
          <Input
            label="Start delay (hours)"
            type="number"
            min={0}
            max={168}
            value={props.startDelayHours}
            onChange={(event) => {
              const next = Number(event.target.value);
              props.onStartDelayHoursChange(Number.isFinite(next) ? next : 0);
            }}
            hint="Hours until mission deployment"
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Engagement</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle checked={props.includeLikes} label="Likes" onChange={props.onToggleLikes} />
              <Toggle checked={props.includeShares} label="Shares" onChange={props.onToggleShares} />
              <Toggle checked={props.includeSaves} label="Saves" onChange={props.onToggleSaves} />
              <Toggle checked={props.includeComments} label="Comments" onChange={props.onToggleComments} />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Advanced</h2>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Delivery time</p>
            <div className="flex flex-wrap gap-2">
              {deliveryModes.map((option) => {
                const active = props.delivery.label === option.label;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => props.onDeliveryChange(option)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {props.delivery.mode === "custom" && (
              <Input
                type="number"
                min={1}
                max={96}
                value={props.customHours}
                onChange={(event) => props.onCustomHoursChange(Number(event.target.value) || 1)}
                className="mt-3 w-36"
                label="Hours"
              />
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Random variance</span>
              <span className="text-sm font-semibold text-indigo-600 tabular-nums">{props.variancePercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={props.variancePercent}
              onChange={(event) => props.onVarianceChange(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <Toggle
            checked={props.peakHoursBoost}
            onChange={props.onPeakHoursChange}
            label="Night boost (6 PM – 11 PM)"
          />
        </div>
      </Card>
    </div>
  );
}
