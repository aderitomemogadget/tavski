import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { ArchiveHistoryView } from "@/components/ArchiveHistory";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/archive/$id")({
  head: () => ({
    meta: [
      { title: "Project history — Tavski" },
      { name: "description", content: "Read-only historical record of an archived project." },
      { property: "og:title", content: "Project history — Tavski" },
      { property: "og:description", content: "Read-only historical record of an archived project." },
    ],
  }),
  component: ArchiveHistoryPage,
});

function ArchiveHistoryPage() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const { projects, clients } = useStore();
  const p = projects.find((x) => x.id === id && x.archived);

  if (!p) {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        {t("Archived project not found.")}{" "}
        <Link to="/archive" className="underline">
          {t("Back to archive")}{" "}</Link>
      </div>
    );
  }

  const client = clients.find((c) => c.id === p.clientId);

  return (
    <>
      <PageHeader
        title={p.product}
        subtitle={
          <>
            {client?.name}
            {client && " · "}
            {client?.country}
            {client && " · "}
            {p.sku} · {t("Archived history")}{" "}</>
        }
      />
      <ArchiveHistoryView p={p} client={client} />
    </>
  );
}
