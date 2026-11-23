import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { StatusPill } from "@/components/StatusPill";
import { useStore } from "@/lib/store";
import { deliveryDateOf } from "@/lib/mock-data";
import { formatDate } from "@/lib/dates";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";

export const Route = createFileRoute("/_app/products/")({
  head: () => ({ meta: [{ title: "Products — Tavski" }] }),
  component: ProductsList,
});

function ProductsList() {
  const { t } = useI18n();
  const { projects, clients } = useStore();
  const items = projects.filter((p) => !p.archived);
  const getClient = (id: string) => clients.find((c) => c.id === id);

  return (
    <>
      <PageHeader
        title={t("Products")}
        subtitle={t("Every active SKU in motion.")}
        actions={
          <ProjectFormDialog
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t("New product")}</Button>}
          />
        }
      />
      <div className="px-6 py-5">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2.5 text-xs uppercase tracking-wide">{t("Product")}</th>
                <th className="px-3 py-2.5 text-xs uppercase tracking-wide">{t("Client")}</th>
                <th className="px-3 py-2.5 text-xs uppercase tracking-wide">{t("Country")}</th>
                <th className="px-3 py-2.5 text-xs uppercase tracking-wide">{t("Status")}</th>
                <th className="px-3 py-2.5 text-xs uppercase tracking-wide">{t("Production delivery")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const c = getClient(p.clientId);
                if (!c) return null;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <Link to="/products/$id" params={{ id: p.id }} className="font-medium hover:underline">
                        {p.product}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </td>
                    <td className="px-3 py-3">{c.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.country}</td>
                    <td className="px-3 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-3 py-3 tabular-nums">{formatDate(deliveryDateOf(p))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
