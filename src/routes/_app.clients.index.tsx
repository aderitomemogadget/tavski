import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/components/forms/ClientFormDialog";

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({ meta: [{ title: "Clients — Tavski" }] }),
  component: ClientsList,
});

function ClientsList() {
  const { clients, projects } = useStore();
  const sorted = [...clients].sort((a, b) => {
    const ax = a.createdAt ?? "";
    const bx = b.createdAt ?? "";
    if (ax === bx) return a.name.localeCompare(b.name);
    return ax < bx ? 1 : -1;
  });
  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Per-client memory: requirements, channels, active and archived projects."
        actions={
          <ClientFormDialog
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New client</Button>}
          />
        }
      />
      <div className="px-6 py-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((c) => {
          const active = new Set(projects.filter((p) => p.clientId === c.id && !p.archived).map((p) => p.id)).size;
          const archived = new Set(projects.filter((p) => p.clientId === c.id && p.archived).map((p) => p.id)).size;
          const status = c.status ?? "Active";
          const statusTone =
            status === "Active"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
              : status === "Prospect"
                ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                : status === "Dormant"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-red-500/10 text-red-600 border-red-500/30";
          return (
            <Link
              key={c.id}
              to="/clients/$id"
              params={{ id: c.id }}
              className="rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.country}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${statusTone}`}>{status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Commercial: {c.commercialResponsible || "—"}</span>
                <span>{active} active · {archived} archived</span>
              </div>
              {status === "Lost" && c.lostReason && (
                <div className="mt-2 text-xs text-red-600">Lost: {c.lostReason}</div>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
