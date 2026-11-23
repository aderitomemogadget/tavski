import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { formatDate } from "@/lib/dates";
import { DeptBadge } from "@/components/StatusPill";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/timeline/")({
  head: () => ({ meta: [{ title: "Timeline — Tavski" }] }),
  component: TimelinePage,
});

function TimelinePage() {
  const { projects, clients } = useStore();
  const events = projects
    .filter((p) => !p.archived && p.timeline.length > 0)
    .map((p) => {
      const last = p.timeline[p.timeline.length - 1];
      return {
        ...last,
        project: p,
        client: clients.find((c) => c.id === p.clientId),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <PageHeader title="Timeline" subtitle="Latest event of each active project, newest first." />
      <div className="px-6 py-5">
        <ol className="relative border-l border-border ml-2">
          {events.map((e, i) => (
            <li key={i} className="ml-4 py-3">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-foreground/80 border border-background" />
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="tabular-nums text-muted-foreground w-24">{formatDate(e.date)}</span>
                <DeptBadge dept={e.department} />
                <span className="font-medium">{e.status}</span>
                <Link
                  to="/products/$id"
                  params={{ id: e.project.id }}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  · {e.client?.name ?? "—"} / {e.project.product}
                </Link>
              </div>
              {e.comment && <div className="mt-1 text-sm">{e.comment}</div>}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
