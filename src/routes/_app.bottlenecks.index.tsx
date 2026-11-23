import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { type Department } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/bottlenecks/")({
  head: () => ({ meta: [{ title: "Bottlenecks — Tavski" }] }),
  component: BottlenecksPage,
});

const ORDER: Department[] = ["Client", "Regulatory", "Production", "Logistics", "Finance"];

function BottlenecksPage() {
  const { t } = useI18n();
  const { projects, clients } = useStore();
  const blocked = projects.filter(
    (p) => !p.archived && p.bottleneck && !!p.bottleneck.description?.trim(),
  );

  const groups = ORDER.map((dept) => ({
    dept,
    items: blocked.filter((p) => p.bottleneck!.department === dept),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader title={t("Bottlenecks")} subtitle={t("Where work is stuck — grouped by responsible department.")} />
      <div className="px-6 py-5 grid gap-4 lg:grid-cols-2">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground lg:col-span-2">{t("No active bottlenecks. All projects are progressing.")}</p>
        )}
        {groups.map((g) => (
          <section key={g.dept} className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-medium">{t(g.dept)}</h2>
              <span className="text-xs text-muted-foreground">{t("{count} blocked", { count: g.items.length })}</span>
            </header>
            {g.items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t("All clear.")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {g.items.map((p) => {
                  const c = clients.find((x) => x.id === p.clientId);
                  return (
                    <li key={p.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link to="/products/$id" params={{ id: p.id }} className="font-medium hover:underline">
                            {c?.name ?? "—"} — {p.product}
                          </Link>
                          <div className="text-sm text-muted-foreground">{p.bottleneck!.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">{t("Next:")}{" "}{p.nextAction}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
