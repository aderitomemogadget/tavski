import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Package, GitBranch, Archive, AlertTriangle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/clients", label: "Clients", icon: Users, exact: false },
  { to: "/products", label: "Products", icon: Package, exact: false },
  { to: "/timeline", label: "Timeline", icon: GitBranch, exact: false },
  { to: "/bottlenecks", label: "Bottlenecks", icon: AlertTriangle, exact: false },
  { to: "/archive", label: "Archive", icon: Archive, exact: false },
];

export function AppLayout() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    await fetch(`${import.meta.env.BASE_URL}_access`, { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    window.location.replace(`${import.meta.env.BASE_URL}auth`);
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-foreground text-background flex items-center justify-center text-[12px] font-semibold tracking-tight">
              T
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-tight text-sidebar-foreground leading-none">Tavski</div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground leading-none">by Atisav Pharma</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 pt-1">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as string}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-foreground" />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 pb-3"><LanguageSelector /></div>
          {email && (
            <div className="px-2 pb-1.5 text-[11px] text-muted-foreground truncate" title={email}>
              {email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" /> {t("Sign out")}{" "}</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-foreground text-background flex items-center justify-center text-[10px] font-semibold">
              T
            </div>
            <span className="font-semibold tracking-tight">Tavski</span>
          </div>
          <div className="ml-auto"><LanguageSelector /></div>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("Sign out")}{" "}</button>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-background/85 backdrop-blur-md px-6 py-5 flex flex-col sm:flex-row items-start justify-between gap-4 sticky top-0 z-10">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight leading-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground leading-snug">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 max-w-full [&>div]:flex-wrap">{actions}</div>}
    </div>
  );
}
