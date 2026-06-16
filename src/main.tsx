import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { AdminPage } from "./pages/AdminPage.tsx";
import { supabase } from "./lib/supabase.ts";

const STORAGE_KEY = "truesmm-access-key";

function useHash(): string {
  const [hash, setHash] = useState<string>(
    typeof window !== "undefined" ? window.location.hash : ""
  );
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function Root() {
  const hash = useHash();
  const isAdminRoute = hash === "#admin" || hash === "#/admin";

  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

  useEffect(() => {
    if (isAdminRoute) return; // admin page handles its own auth
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminRoute]);

  const checkAuth = async () => {
    try {
      const savedKey = localStorage.getItem(STORAGE_KEY);

      if (!savedKey || !savedKey.trim()) {
        setAuthState("unauthenticated");
        return;
      }

      const { data, error } = await supabase
        .from("access_keys")
        .select("is_active, expires_at")
        .eq("key", savedKey)
        .single();

      if (error || !data || !data.is_active) {
        localStorage.removeItem(STORAGE_KEY);
        setAuthState("unauthenticated");
        return;
      }

      // 🔥 Expiry check
      if (data.expires_at && Date.now() >= new Date(data.expires_at).getTime()) {
        localStorage.removeItem(STORAGE_KEY);
        setAuthState("unauthenticated");
        return;
      }

      setAuthState("authenticated");
    } catch (err) {
      console.error("Auth check failed:", err);
      // Network error fallback — keep user in if they had a key
      const savedKey = localStorage.getItem(STORAGE_KEY);
      setAuthState(savedKey && savedKey.trim() ? "authenticated" : "unauthenticated");
    }
  };

  // ===== Admin route =====
  if (isAdminRoute) {
    return <AdminPage />;
  }

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl">🚀</span>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-sm text-slate-500">Initializing TRUESMM...</span>
          </div>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginPage onAuthenticated={() => setAuthState("authenticated")} />;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
