import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { getBrowserFingerprint } from "../lib/fingerprint";

const STORAGE_KEY = "gotham-access-key";

interface LoginPageProps {
  onAuthenticated: () => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [remainingMsg, setRemainingMsg] = useState("");

  // 🔥 Auto-login: if key already saved, validate it (including expiry) and let in
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY);
    if (!savedKey || !savedKey.trim()) return;

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("access_keys")
          .select("*")
          .eq("key", savedKey)
          .single();

        if (fetchError || !data || !data.is_active) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }

        if (data.expires_at) {
          const expMs = new Date(data.expires_at).getTime();
          if (Date.now() >= expMs) {
            localStorage.removeItem(STORAGE_KEY);
            setError(
              "Your access key has expired. Contact your administrator for a new one."
            );
            return;
          }
        }

        // Verified — let in
        onAuthenticated();
      } catch {
        // Network failure — fall back to localStorage (offline tolerance)
        onAuthenticated();
      }
    })();
  }, [onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = keyInput.trim().toUpperCase();

    if (!trimmedKey) {
      setError("Enter your access key.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const fingerprint = await getBrowserFingerprint();

      const { data, error: fetchError } = await supabase
        .from("access_keys")
        .select("*")
        .eq("key", trimmedKey)
        .single();

      if (fetchError || !data) {
        setError("Invalid access key. Contact your administrator.");
        setLoading(false);
        return;
      }

      if (!data.is_active) {
        setError("This key has been revoked. Contact your administrator.");
        setLoading(false);
        return;
      }

      // ----- First-use path: bind fingerprint AND start the expiry clock -----
      if (data.fingerprint === null) {
        const activatedAt = new Date();
        const updatePayload: Record<string, unknown> = {
          fingerprint,
          activated_at: activatedAt.toISOString(),
        };

        // duration_seconds is set by admin at key creation; null = lifetime
        if (
          typeof data.duration_seconds === "number" &&
          data.duration_seconds > 0
        ) {
          const expiresAt = new Date(
            activatedAt.getTime() + data.duration_seconds * 1000
          );
          updatePayload.expires_at = expiresAt.toISOString();
        }

        const { error: updateError } = await supabase
          .from("access_keys")
          .update(updatePayload)
          .eq("key", trimmedKey);

        if (updateError) {
          setError("Activation failed. Try again.");
          setLoading(false);
          return;
        }

        localStorage.setItem(STORAGE_KEY, trimmedKey);

        if (updatePayload.expires_at) {
          const ms =
            new Date(updatePayload.expires_at as string).getTime() - Date.now();
          setRemainingMsg(`Valid for ${formatRemaining(ms)}`);
        } else {
          setRemainingMsg("Lifetime access");
        }

        setSuccess(true);
        setTimeout(() => onAuthenticated(), 1500);
        return;
      }

      // ----- Returning use path: fingerprint already set -----
      // For now we keep your original behavior (single-device lock).
      // But also check expiry here in case admin imported a pre-bound key.
      if (data.expires_at) {
        const expMs = new Date(data.expires_at).getTime();
        if (Date.now() >= expMs) {
          setError(
            "This key has expired. Contact your administrator for a new one."
          );
          setLoading(false);
          return;
        }
      }

      setError(
        "This key has already been used. Each key is single-use only. If this is your browser, access should be automatic."
      );
      setLoading(false);
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/5 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center justify-center"
          >
            <div className="relative">
              <div
                className="absolute inset-0 animate-ping rounded-full bg-yellow-500/20"
                style={{ animationDuration: "3s" }}
              />
              <span className="relative text-6xl">🦇</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-yellow-400">
              GOTHAM
            </h1>
            <p className="mt-1 text-sm text-yellow-600">SMM Command Center</p>
            <p className="mt-3 text-xs text-gray-600">
              Restricted access. Authorized personnel only.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-gray-900 to-black p-8 shadow-2xl shadow-yellow-500/5"
        >
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <span className="text-5xl">✅</span>
              <p className="mt-4 text-lg font-semibold text-emerald-400">
                Access Granted
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Welcome to Gotham Command...
              </p>
              {remainingMsg && (
                <p className="mt-2 text-xs text-yellow-500">{remainingMsg}</p>
              )}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Access Key
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="GOTHAM-KEY-XXX"
                  disabled={loading}
                  autoFocus
                  className="w-full rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm text-white placeholder-gray-700 focus:border-yellow-500/60 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition disabled:opacity-50 font-mono tracking-widest"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
                >
                  <p className="text-xs text-red-400">❌ {error}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading || !keyInput.trim()}
                className="w-full rounded-xl border border-yellow-500/50 bg-yellow-500/20 px-4 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                    Verifying...
                  </span>
                ) : (
                  "🦇 Enter Gotham"
                )}
              </button>

              <p className="text-center text-[10px] text-gray-700">
                Keys are device-locked. One key per browser only.
              </p>
            </form>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center text-[10px] italic text-yellow-600/40"
        >
          "I am vengeance. I am the night. I am Batman."
        </motion.p>
      </motion.div>
    </div>
  );
}
