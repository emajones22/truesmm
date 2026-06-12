import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DEFAULT_ENGAGEMENT_RATIOS,
  type EngagementRatios,
  type RatioPreset,
} from "../types/order";

interface RatiosPageProps {
  activeRatios: EngagementRatios;
  presets: RatioPreset[];
  onSaveActive: (ratios: EngagementRatios) => void;
  onResetActive: () => void;
  onSavePreset: (name: string, ratios: EngagementRatios) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (id: string) => void;
}

type FieldKey = keyof EngagementRatios;

const FIELD_META: { key: FieldKey; label: string; icon: string; hint: string }[] = [
  { key: "likes", label: "Likes", icon: "❤️", hint: "Default 2.5% of views" },
  { key: "shares", label: "Shares", icon: "🔁", hint: "Default 1.75% of views" },
  { key: "saves", label: "Saves", icon: "🔖", hint: "Default 0.45% of views" },
  { key: "comments", label: "Comments", icon: "💬", hint: "Default 0.05% of views" },
  { key: "reposts", label: "Reposts", icon: "📢", hint: "Default 0.85% of views" },
];

function sanitize(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Cap at 100% just for sanity — nothing realistic goes above this.
  return Math.min(100, Math.round(n * 1000) / 1000);
}

export function RatiosPage({
  activeRatios,
  presets,
  onSaveActive,
  onResetActive,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
}: RatiosPageProps) {
  const [draft, setDraft] = useState<EngagementRatios>(activeRatios);
  const [presetName, setPresetName] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleField = (key: FieldKey, raw: string) => {
    setDraft((prev) => ({ ...prev, [key]: sanitize(raw) }));
  };

  const handleSaveActive = () => {
    onSaveActive(draft);
    showToast("✅ Active ratios saved. All new orders will use these.");
  };

  const handleResetActive = () => {
    setDraft(DEFAULT_ENGAGEMENT_RATIOS);
    onResetActive();
    showToast("🔄 Reset to factory defaults.");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      showToast("⚠️ Enter a preset name first.");
      return;
    }
    onSavePreset(name, draft);
    setPresetName("");
    showToast(`💾 Preset "${name}" saved.`);
  };

  const handleApplyPreset = (preset: RatioPreset) => {
    setDraft(preset.ratios);
    onApplyPreset(preset.id);
    showToast(`⚡ Preset "${preset.name}" loaded & set active.`);
  };

  const isDirty = (Object.keys(draft) as FieldKey[]).some(
    (k) => draft[k] !== activeRatios[k]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <h1 className="text-2xl font-bold tracking-tight text-yellow-400 sm:text-3xl">
              Engagement Ratios
            </h1>
          </div>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            Override the default likes / shares / saves / comments / reposts
            ratios. New orders will use the active values below.
          </p>
        </div>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-[11px] uppercase tracking-wider text-yellow-300">
          Active ratios apply to <b>future</b> orders only
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ratios editor */}
      <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-b from-gray-950 to-black p-5 shadow-xl shadow-yellow-500/5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-400">
            Current Draft
          </h2>
          <span
            className={`text-[11px] uppercase tracking-wider ${
              isDirty ? "text-amber-400" : "text-gray-600"
            }`}
          >
            {isDirty ? "Unsaved changes" : "In sync"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELD_META.map((field) => (
            <div
              key={field.key}
              className="rounded-xl border border-gray-800 bg-black/60 p-4 transition hover:border-yellow-500/40"
            >
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-200">
                <span className="text-lg">{field.icon}</span>
                {field.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draft[field.key]}
                  onChange={(e) => handleField(field.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-sm text-yellow-200 outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/40"
                />
                <span className="text-sm font-medium text-yellow-500">%</span>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">{field.hint}</p>
              <p className="mt-1 text-[11px] text-gray-600">
                Active:{" "}
                <span className="text-yellow-500/80">
                  {activeRatios[field.key]}%
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="mt-5 rounded-xl border border-gray-800 bg-black/40 p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">
            Preview for a sample of 10,000 views
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {FIELD_META.map((f) => (
              <span key={f.key} className="text-gray-400">
                {f.icon} {f.label}:{" "}
                <b className="text-yellow-300">
                  {Math.max(
                    f.key === "comments" ? 1 : 10,
                    Math.floor(10000 * (draft[f.key] / 100))
                  )}
                </b>
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSaveActive}
            disabled={!isDirty}
            className="flex-1 min-w-[140px] rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
          >
            💾 Save as Active
          </button>
          <button
            type="button"
            onClick={handleResetActive}
            className="flex-1 min-w-[140px] rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            🔄 Reset to Defaults
          </button>
          <button
            type="button"
            onClick={() => setDraft(activeRatios)}
            disabled={!isDirty}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-300 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↩ Revert draft
          </button>
        </div>
      </div>

      {/* Save as preset */}
      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-gradient-to-b from-gray-950 to-black p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-yellow-400">
          Save current draft as preset
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="e.g. Aggressive growth, Instagram Reels, Soft launch…"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/40"
          />
          <button
            type="button"
            onClick={handleSavePreset}
            className="rounded-lg bg-yellow-500/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-yellow-400"
          >
            ➕ Save preset
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Presets are saved to your browser. Click any preset below to load &
          apply it instantly.
        </p>
      </div>

      {/* Preset list */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-yellow-400">
          Saved Presets ({presets.length})
        </h2>
        {presets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-800 bg-black/40 p-8 text-center text-sm text-gray-500">
            No presets yet. Tweak the ratios above and save your first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((preset) => (
              <motion.div
                key={preset.id}
                layout
                className="rounded-xl border border-gray-800 bg-gradient-to-b from-gray-950 to-black p-4 transition hover:border-yellow-500/40"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-yellow-300">
                    {preset.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete preset "${preset.name}"?`)) {
                        onDeletePreset(preset.id);
                      }
                    }}
                    className="text-xs text-red-400/80 transition hover:text-red-300"
                    aria-label="Delete preset"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1 text-[11px] text-gray-400">
                  {FIELD_META.map((f) => (
                    <div key={f.key} className="flex justify-between">
                      <span>
                        {f.icon} {f.label}
                      </span>
                      <span className="font-mono text-yellow-200">
                        {preset.ratios[f.key]}%
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="mt-3 w-full rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-300 transition hover:bg-yellow-500/20"
                >
                  ⚡ Load & set active
                </button>
                <p className="mt-2 text-[10px] text-gray-600">
                  Created {new Date(preset.createdAt).toLocaleString()}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
