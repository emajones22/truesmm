import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

const ADMIN_SESSION_KEY = "gotham-admin-session";
const ADMIN_PASSWORD =
  (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || "gotham";

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
  // GOTHAM-XXXX-XXXX-XXXX
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n: number) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `GOTHAM-${block(4)}-${block(4)}-${block(4)}`;
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
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    icon: "🆕",
  },
  active: {
    label: "Active",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    icon: "✅",
  },
  expired: {
    label: "Expired",
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    icon: "⏰",
  },
  revoked: {
    label: "Revoked",
    bg: "bg-red-500/15",
    text: "text-red-300",
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
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-950" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md"
        >
          <div className="text-center mb-8">
            <span className="text-6xl">🛡️</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-yellow-400">
              ADMIN
            </h1>
            <p className="mt-1 text-sm text-yellow-600">Key Management Console</p>
          </div>
          <form
            onSubmit={handleLogin}
            className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-gray-900 to-black p-8 space-y-4"
          >
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
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
              className="w-full rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/60"
            />
            {pwError && (
              <p className="text-xs text-red-400">❌ {pwError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl border border-yellow-500/50 bg-yellow-500/20 px-4 py-3 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/30 transition"
            >
              🔓 Unlock
            </button>
            <p className="text-center text-[10px] text-gray-700">
              Set the password via <code>VITE_ADMIN_PASSWORD</code> at build
              time. Default is <code>gotham</code>.
            </p>
          </form>
          <p className="mt-4 text-center text-[10px] text-gray-700">
            Go back: <a className="text-yellow-500/70" href="#">remove #admin from URL</a>
          </p>
        </motion.div>
      </div>
    );
  }

  // ===== Admin dashboard =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">🛡️</span>
              <h1 className="text-2xl font-bold tracking-tight text-yellow-400 sm:text-3xl">
                Admin — Access Keys
              </h1>
            </div>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Create, set duration, revoke, extend, and unbind keys. Keys'
              timers start when the user first logs in.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#"
              className="rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-900 transition"
            >
              ← Back to app
            </a>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition"
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
              className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {loadError}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { l: "Total", v: stats.total, c: "text-gray-300" },
            { l: "🆕 Unused", v: stats.unused, c: "text-blue-300" },
            { l: "✅ Active", v: stats.active, c: "text-emerald-300" },
            { l: "⏰ Expired", v: stats.expired, c: "text-orange-300" },
            { l: "🚫 Revoked", v: stats.revoked, c: "text-red-300" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-xl border border-gray-800 bg-black/40 px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                {s.l}
              </p>
              <p className={`mt-1 text-2xl font-bold ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-gradient-to-b from-gray-950 to-black p-5 shadow-xl shadow-yellow-500/5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-yellow-400">
            Create a new key
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-gray-500">
                Key
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-yellow-200 outline-none focus:border-yellow-500/60"
                />
                <button
                  type="button"
                  onClick={() => setNewKey(randomKey())}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                  title="Generate random key"
                >
                  🎲
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500">
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
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-yellow-500/60"
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
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-yellow-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => setUseCustom(false)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                  >
                    ↩
                  </button>
                </div>
              )}
              <p className="mt-1 text-[10px] text-gray-600">
                Timer starts at first login. Lifetime = never expires.
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500">
                Note (optional)
              </label>
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="e.g. for Alex - paid trial"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-yellow-500/60"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {creating ? "Creating…" : "➕ Create key"}
            </button>
            <span className="text-[11px] text-gray-500">
              Selected:{" "}
              <b className="text-yellow-300">
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
        <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-b from-gray-950 to-black p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-400">
              All Keys ({keys.length})
            </h2>
            <button
              type="button"
              onClick={loadKeys}
              disabled={loading}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {keys.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-gray-800 bg-black/40 py-10 text-center text-sm text-gray-500">
              No keys yet. Create your first one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Activated</th>
                    <th className="px-3 py-2">Expires</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {keys.map((k) => {
                    const s = keyStatus(k);
                    const meta = STATUS_META[s];
                    const remaining = k.expires_at
                      ? new Date(k.expires_at).getTime() - Date.now()
                      : null;
                    return (
                      <tr key={k.key} className="hover:bg-gray-900/40 align-top">
                        <td className="px-3 py-2">
                          <button
                            onClick={() => copyKey(k.key)}
                            title="Click to copy"
                            className="font-mono text-yellow-200 hover:text-yellow-100"
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
                            <div className="mt-1 text-[10px] text-emerald-400/80">
                              ⏱ {formatRemaining(remaining)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-300">
                          {formatDuration(k.duration_seconds ?? null)}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          {k.activated_at
                            ? new Date(k.activated_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          {k.expires_at
                            ? new Date(k.expires_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-400 max-w-[180px] truncate" title={k.note || ""}>
                          {k.note || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap justify-end gap-1">
                            {s === "active" && (
                              <>
                                <button
                                  onClick={() => handleExtend(k, 60 * 60)}
                                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
                                  title="Extend expiry by 1 hour"
                                >
                                  +1h
                                </button>
                                <button
                                  onClick={() => handleExtend(k, 24 * 60 * 60)}
                                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
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
                                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
                                  title="Set expiry to 1 day from now"
                                >
                                  +1d
                                </button>
                              </>
                            )}
                            {s !== "revoked" ? (
                              <button
                                onClick={() => handleRevoke(k)}
                                className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/20"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(k)}
                                className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
                              >
                                Reactivate
                              </button>
                            )}
                            {k.fingerprint && (
                              <button
                                onClick={() => handleResetFingerprint(k)}
                                className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300 hover:bg-blue-500/20"
                                title="Unbind device + reset expiry timer"
                              >
                                Unbind
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(k)}
                              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800"
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

        <p className="mt-6 text-center text-[10px] italic text-yellow-600/30">
          "It's not who I am underneath, but what I do that defines me."
        </p>
      </div>
    </div>
  );
}
