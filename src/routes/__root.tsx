import { useI18n } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("Page not found")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("The page you're looking for doesn't exist or has been moved.")}{" "}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Go to dashboard")}{" "}</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("This page didn't load")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("Something went wrong. Try refreshing.")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Try again")}{" "}</button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tavski" },
      { name: "description", content: "Tavski — operational clarity for pharmaceutical brands, exporters and distributors. By Atisav Pharma." },
      { property: "og:title", content: "Tavski" },
      { name: "twitter:title", content: "Tavski" },
      { property: "og:description", content: "Tavski — operational clarity for pharmaceutical brands, exporters and distributors. By Atisav Pharma." },
      { name: "twitter:description", content: "Tavski — operational clarity for pharmaceutical brands, exporters and distributors. By Atisav Pharma." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ae8046d8-21d5-467d-a37f-847f39744d41/id-preview-73a1d23b--a2455bc8-a7e1-4b7c-89b1-0bbaea9800f1.lovable.app-1780791524880.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ae8046d8-21d5-467d-a37f-847f39744d41/id-preview-73a1d23b--a2455bc8-a7e1-4b7c-89b1-0bbaea9800f1.lovable.app-1780791524880.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  return (
    <html lang={language}>
      <head>
        <HeadContent />
      </head>
      <body>
        <LanguageMetadata />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function LanguageMetadata() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const path = base && (pathname === base || pathname.startsWith(`${base}/`))
      ? pathname.slice(base.length) : pathname;
    const section = path.split("/").filter(Boolean)[0] ?? "";
    const titles: Record<string, string> = {
      "": "Dashboard", auth: "Sign in", clients: "Clients", products: "Products",
      timeline: "Timeline", bottlenecks: "Bottlenecks", archive: "Archive",
    };
    document.title = `${t(titles[section] ?? "Page not found")} — Tavski`;
  }, [pathname, t]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
