import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

const ADMIN_SESSION_KEY = "truesmm-admin-session";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;

interface AccessKeyRow {
  id?: number | string;
  key: string;
  is_active: boolean;
  fingerprint: string | null;
  activated_at: string | null;
  expires_at: string | null;
  duration_seconds: number | null;
  created_at?: string | null;
  note?: string | null;
}

interface DurationOption {
  label: string;
  seconds: number | null; // null = lifetime
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: "10 minutes", seconds: 10 * 60 },
  { label: "30 minutes", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "6 hours", seconds: 6 * 60 * 60 },
  { label: "12 hours", seconds: 12 * 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "3 days", seconds: 3 * 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { label: "Lifetime (never expires)", seconds: null },
];

function randomKey(): string {
  // TRUESMM-XXXX-XXXX-XXXX
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n: number) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `TRUESMM-${block(4)}-${block(4)}-${block(4)}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m left`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h left`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "Lifetime";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

type KeyStatus =
  | "unused"
  | "active"
  | "expired"
  | "revoked";

function keyStatus(k: AccessKeyRow): KeyStatus {
  if (!k.is_active) return "revoked";
  if (!k.fingerprint) return "unused";
  if (k.expires_at && Date.now() >= new Date(k.expires_at).getTime())
    return "expired";
  return "active";
}

const STATUS_META: Record<
  KeyStatus,
  { label: string; bg: string; text: string; icon: string }
> = {
  unused: {
    label: "Unused",
    bg: "bg-blue-100",
    text: "text-blue-600",
    icon: "🆕",
  },
  active: {
    label: "Active",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: "✅",
  },
  expired: {
    label: "Expired",
    bg: "bg-orange-50",
    text: "text-orange-700",
    icon: "⏰",
  },
  revoked: {
    label: "Revoked",
    bg: "bg-rose-50",
    text: "text-rose-700",
    icon: "🚫",
  },
};

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean>(() => {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  });
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  const [keys, setKeys] = useState<AccessKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // create form
  const [newKey, setNewKey] = useState(randomKey());
  const [newDuration, setNewDuration] = useState<DurationOption>(
    DURATION_OPTIONS[5]
  );
  const [customMinutes, setCustomMinutes] = useState<number>(0);
  const [useCustom, setUseCustom] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");

  // tick clock for "X left" countdowns
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fireToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 6000);
  };

  // 🔥 Properly unpack Supabase / unknown errors into a readable string
  function describeError(e: unknown): string {
    if (!e) return "Unknown error";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message;
    // Supabase returns objects like { message, details, hint, code }
    const anyE = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof anyE.message === "string") parts.push(anyE.message);
    if (typeof anyE.details === "string") parts.push(`details: ${anyE.details}`);
    if (typeof anyE.hint === "string") parts.push(`hint: ${anyE.hint}`);
    if (typeof anyE.code === "string") parts.push(`code: ${anyE.code}`);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  const loadKeys = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("access_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setKeys((data as AccessKeyRow[]) || []);
    } catch (e: unknown) {
      setLoadError(
        `Could not load keys. Make sure the access_keys table has the new columns (duration_seconds, expires_at, note) and admin row-level read access. Details: ${describeError(e)}`
      );
      console.error("Load keys failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) loadKeys();
  }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD) {
      setPwError("Admin password is not configured. Set VITE_ADMIN_PASSWORD in Vercel.");
      return;
    }
    if (pwInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      setAuthed(true);
      setPwError("");
    } else {
      setPwError("Wrong password.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthed(false);
    setPwInput("");
  };

  const effectiveSeconds = (): number | null => {
    if (useCustom) {
      const m = Math.max(0, Math.floor(customMinutes));
      return m === 0 ? null : m * 60;
    }
    return newDuration.seconds;
  };

  const handleCreate = async () => {
    const trimmed = newKey.trim().toUpperCase();
    if (!trimmed) {
      fireToast("⚠️ Key cannot be empty.");
      return;
    }
    setCreating(true);
    try {
      const payload: Partial<AccessKeyRow> = {
        key: trimmed,
        is_active: true,
        fingerprint: null,
        activated_at: null,
        expires_at: null,
        duration_seconds: effectiveSeconds(),
        note: newNote.trim() || null,
      };
      const { error } = await supabase.from("access_keys").insert(payload);
      if (error) throw error;
      fireToast(`✅ Key created: ${trimmed}`);
      setNewKey(randomKey());
      setNewNote("");
      await loadKeys();
    } catch (e: unknown) {
      fireToast(`❌ ${describeError(e)}`);
      console.error("Create key failed:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (k: AccessKeyRow) => {
    if (!confirm(`Revoke key "${k.key}"? Users will be locked out immediately.`))
      return;
    const { error } = await supabase
      .from("access_keys")
      .update({ is_active: false })
      .eq("key", k.key);
    if (error) {
      fireToast(`❌ ${describeError(error)}`);
      return;
    }
    fireToast("🚫 Key revoked.");
    loadKeys();
  };

  const handleReactivate = async (k: AccessKeyRow) => {
    if (!confirm(`Reactivate key "${k.key}"?`)) return;
    const { error } = await supabase
      .from("access_keys")
      .update({ is_active: true })
      .eq("key", k.key);
    if (error) {
      fireToast(`❌ ${describeError(error)}`);
      return;
    }
    fireToast("✅ Key reactivated.");
    loadKeys();
  };

  const handleResetFingerprint = async (k: AccessKeyRow) => {
    if (
      !confirm(
        `Unbind device for "${k.key}"? The next person who enters this key on any browser will activate it freshly.`
      )
    )
      return;
    const { error } = await supabase
      .from("access_keys")
      .update({ fingerprint: null, activated_at: null, expires_at: null })
      .eq("key", k.key);
    if (error) {
      fireToast(`❌ ${describeError(error)}`);
      return;
    }
    fireToast("🔄 Device unbound. Expiry timer also reset.");
    loadKeys();
  };

  const handleExtend = async (k: AccessKeyRow, extraSeconds: number) => {
    const baseMs = k.expires_at
      ? new Date(k.expires_at).getTime()
      : Date.now();
    // If already expired, extend from now instead of past time
    const fromMs = baseMs < Date.now() ? Date.now() : baseMs;
    const newExp = new Date(fromMs + extraSeconds * 1000).toISOString();
    const { error } = await supabase
      .from("access_keys")
      .update({ expires_at: newExp })
      .eq("key", k.key);
    if (error) {
      fireToast(`❌ ${describeError(error)}`);
      return;
    }
    fireToast(`⏰ Extended by ${formatDuration(extraSeconds)}.`);
    loadKeys();
  };

  const handleDelete = async (k: AccessKeyRow) => {
    if (
      !confirm(
        `PERMANENTLY DELETE key "${k.key}"? This cannot be undone. Prefer Revoke instead.`
      )
    )
      return;
    const { error } = await supabase
      .from("access_keys")
      .delete()
      .eq("key", k.key);
    if (error) {
      fireToast(`❌ ${describeError(error)}`);
      return;
    }
    fireToast("🗑️ Key deleted.");
    loadKeys();
  };

  const copyKey = async (k: string) => {
    try {
      await navigator.clipboard.writeText(k);
      fireToast(`📋 Copied: ${k}`);
    } catch {
      fireToast("⚠️ Could not copy.");
    }
  };

  const stats = useMemo(() => {
    const s = { total: keys.length, unused: 0, active: 0, expired: 0, revoked: 0 };
    for (const k of keys) s[keyStatus(k)]++;
    return s;
  }, [keys]);

  // ===== Auth gate =====
  if (!authed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-slate-50" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md"
        >
          <div className="text-center mb-8">
            <span className="text-6xl">🛡️</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-blue-600">
              ADMIN
            </h1>
            <p className="mt-1 text-sm text-slate-500">Key Management Console</p>
          </div>
          <form
            onSubmit={handleLogin}
            className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4"
          >
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Admin Password
            </label>
            <input
              type="password"
              value={pwInput}
              onChange={(e) => {
                setPwInput(e.target.value);
                setPwError("");
              }}
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
            />
            {pwError && (
              <p className="text-xs text-rose-600">❌ {pwError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              🔓 Unlock
            </button>
            <p className="text-center text-[10px] text-slate-700">
              Set the password via <code>VITE_ADMIN_PASSWORD</code> at build
              time. No default password is set.
            </p>
          </form>
          <p className="mt-4 text-center text-[10px] text-slate-700">
            Go back: <a className="text-blue-700/80" href="#">remove #admin from URL</a>
          </p>
        </motion.div>
      </div>
    );
  }

  // ===== Admin dashboard =====
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">🛡️</span>
              <h1 className="text-2xl font-bold tracking-tight text-blue-600 sm:text-3xl">
                Admin — Access Keys
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Create, set duration, revoke, extend, and unbind keys. Keys'
              timers start when the user first logs in.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#"
              className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-500 hover:bg-white transition"
            >
              ← Back to app
            </a>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 transition"
            >
              🔒 Lock
            </button>
          </div>
        </header>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-lg border border-slate-200 bg-blue-50 px-4 py-2 text-sm text-blue-800"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {loadError}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { l: "Total", v: stats.total, c: "text-slate-600" },
            { l: "🆕 Unused", v: stats.unused, c: "text-blue-600" },
            { l: "✅ Active", v: stats.active, c: "text-emerald-700" },
            { l: "⏰ Expired", v: stats.expired, c: "text-orange-700" },
            { l: "🚫 Revoked", v: stats.revoked, c: "text-rose-700" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {s.l}
              </p>
              <p className={`mt-1 text-2xl font-bold ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-xl shadow-slate-200/50 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Create a new key
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-slate-500">
                Key
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-blue-800 outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setNewKey(randomKey())}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                  title="Generate random key"
                >
                  🎲
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">
                Active duration
              </label>
              {!useCustom ? (
                <select
                  value={String(newDuration.seconds ?? "null")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") {
                      setUseCustom(true);
                      return;
                    }
                    const opt =
                      DURATION_OPTIONS.find(
                        (o) => String(o.seconds ?? "null") === v
                      ) || DURATION_OPTIONS[0];
                    setNewDuration(opt);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                >
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.label} value={String(o.seconds ?? "null")}>
                      {o.label}
                    </option>
                  ))}
                  <option value="custom">Custom (minutes)…</option>
                </select>
              ) : (
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={customMinutes || ""}
                    onChange={(e) =>
                      setCustomMinutes(Math.max(0, Number(e.target.value) || 0))
                    }
                    placeholder="minutes"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setUseCustom(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    ↩
                  </button>
                </div>
              )}
              <p className="mt-1 text-[10px] text-slate-600">
                Timer starts at first login. Lifetime = never expires.
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">
                Note (optional)
              </label>
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="e.g. for Alex - paid trial"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : "➕ Create key"}
            </button>
            <span className="text-[11px] text-slate-500">
              Selected:{" "}
              <b className="text-blue-700">
                {useCustom
                  ? customMinutes > 0
                    ? `${customMinutes} min`
                    : "Lifetime"
                  : newDuration.label}
              </b>
            </span>
          </div>
        </div>

        {/* Keys table */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              All Keys ({keys.length})
            </h2>
            <button
              type="button"
              onClick={loadKeys}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {keys.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 py-10 text-center text-sm text-slate-500">
              No keys yet. Create your first one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Activated</th>
                    <th className="px-3 py-2">Expires</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {keys.map((k) => {
                    const s = keyStatus(k);
                    const meta = STATUS_META[s];
                    const remaining = k.expires_at
                      ? new Date(k.expires_at).getTime() - Date.now()
                      : null;
                    return (
                      <tr key={k.key} className="hover:bg-slate-100 align-top">
                        <td className="px-3 py-2">
                          <button
                            onClick={() => copyKey(k.key)}
                            title="Click to copy"
                            className="font-mono text-blue-800 hover:text-blue-600"
                          >
                            {k.key}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${meta.bg} ${meta.text}`}
                          >
                            <span>{meta.icon}</span>
                            {meta.label}
                          </span>
                          {s === "active" && remaining !== null && (
                            <div className="mt-1 text-[10px] text-emerald-600/80">
                              ⏱ {formatRemaining(remaining)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {formatDuration(k.duration_seconds ?? null)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {k.activated_at
                            ? new Date(k.activated_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {k.expires_at
                            ? new Date(k.expires_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate" title={k.note || ""}>
                          {k.note || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap justify-end gap-1">
                            {s === "active" && (
                              <>
                                <button
                                  onClick={() => handleExtend(k, 60 * 60)}
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100"
                                  title="Extend expiry by 1 hour"
                                >
                                  +1h
                                </button>
                                <button
                                  onClick={() => handleExtend(k, 24 * 60 * 60)}
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100"
                                  title="Extend expiry by 1 day"
                                >
                                  +1d
                                </button>
                              </>
                            )}
                            {(s === "expired" || s === "unused") && (
                              <>
                                <button
                                  onClick={() => handleExtend(k, 24 * 60 * 60)}
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100"
                                  title="Set expiry to 1 day from now"
                                >
                                  +1d
                                </button>
                              </>
                            )}
                            {s !== "revoked" ? (
                              <button
                                onClick={() => handleRevoke(k)}
                                className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-700 hover:bg-rose-100"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(k)}
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100"
                              >
                                Reactivate
                              </button>
                            )}
                            {k.fingerprint && (
                              <button
                                onClick={() => handleResetFingerprint(k)}
                                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-600 hover:bg-blue-100"
                                title="Unbind device + reset expiry timer"
                              >
                                Unbind
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(k)}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100"
                              title="Permanently delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] italic text-slate-500/40">
          "It's not who I am underneath, but what I do that defines me."
        </p>
      </div>
    </div>
  );
}
