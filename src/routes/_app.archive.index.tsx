import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { useStore, type Project } from "@/lib/store";
import { deliveryDateOf } from "@/lib/mock-data";
import { formatDate } from "@/lib/dates";
import { History } from "lucide-react";

export const Route = createFileRoute("/_app/archive/")({
  head: () => ({
    meta: [
      { title: "Archive — Tavski" },
      { name: "description", content: "Permanent historical memory of completed projects." },
      { property: "og:title", content: "Archive — Tavski" },
      { property: "og:description", content: "Permanent historical memory of completed projects." },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { t, count } = useI18n();
  const { projects, clients } = useStore();
  const items = projects.filter((p) => p.archived);

  // Group by Country → Client → Projects
  const byCountry = new Map<string, Map<string, Project[]>>();
  for (const p of items) {
    const client = clients.find((c) => c.id === p.clientId);
    const country = client?.country ?? t("Unknown");
    const clientName = client?.name ?? t("Unknown");
    if (!byCountry.has(country)) byCountry.set(country, new Map());
    const clientMap = byCountry.get(country)!;
    if (!clientMap.has(clientName)) clientMap.set(clientName, []);
    clientMap.get(clientName)!.push(p);
  }
  const countries = [...byCountry.keys()].sort();

  return (
    <>
      <PageHeader
        title={t("Archive")}
        subtitle={t("Permanent historical memory. Completed projects grouped by Country → Client → Product. Read-only.")}
      />
      <div className="px-6 py-5 space-y-8">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("No archived projects yet.")}</p>
        )}

        {countries.map((country) => {
          const clientMap = byCountry.get(country)!;
          const clientNames = [...clientMap.keys()].sort();
          const totalProjects = clientNames.reduce((n, k) => n + clientMap.get(k)!.length, 0);
          return (
            <section key={country} className="space-y-4">
              <header className="flex items-baseline gap-3 border-b border-border pb-2">
                <h2 className="text-lg font-semibold">{country}</h2>
                <span className="text-xs text-muted-foreground">
                  {count("client", clientNames.length)} · {count("project", totalProjects)}
                </span>
              </header>
              {clientNames.map((clientName) => {
                const list = clientMap.get(clientName)!;
                return (
                  <div key={clientName} className="space-y-2 pl-2">
                    <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.18em]">
                      {clientName}
                    </h3>
                    <div className="rounded-lg border border-border bg-card divide-y divide-border">
                      {list.map((p) => (
                        <ArchivedRow key={p.id} p={p} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

function ArchivedRow({ p }: { p: Project }) {
  const { t, count } = useI18n();
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {p.product}
          <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{t(p.status)}</span>
          <span>{t("Lead time")}{" "}{count("day", p.leadTimeDays)}</span>
          <span>{t("Production delivery")}{" "}{formatDate(deliveryDateOf(p))}</span>
          <span>
            {count("event", p.timeline.length)}
          </span>
        </div>
      </div>
      <Link
        to="/archive/$id"
        params={{ id: p.id }}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
      >
        <History className="h-3.5 w-3.5" />
        {t("View history")}{" "}</Link>
    </div>
  );
}
