import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

// Recheck an already-open SPA after expiry/password rotation as well as on navigation.
export function AccessGateMonitor({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}_access`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 503) {
          setBlocked(true);
          window.location.replace(window.location.href);
          return;
        }
        const state = await response.json();
        if (!response.ok || state.authenticated !== true) throw new Error("Access unavailable");
      } catch {
        if (!controller.signal.aborted) setBlocked(true);
      } finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 30000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]);

  if (blocked) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center" role="alert">
        <p className="text-sm text-muted-foreground">{t("Unable to verify access. Please try again.")}</p>
        <button type="button" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => window.location.reload()}>{t("Try again")}</button>
      </div>
    </div>
  );
  return children;
}
