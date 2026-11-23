import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { StatusPill } from "@/components/StatusPill";
import { useStore, type Project } from "@/lib/store";
import { Mail, MessageCircle, Phone, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/components/forms/ClientFormDialog";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";

export const Route = createFileRoute("/_app/clients/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Tavski` }] }),
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const { clients, projects } = useStore();
  const client = clients.find((c) => c.id === id);

  if (!client) {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        Client not found. <Link to="/clients" className="underline">Back to clients</Link>
      </div>
    );
  }

  const active = projects.filter((p) => p.clientId === client.id && !p.archived);
  const archived = projects.filter((p) => p.clientId === client.id && p.archived);

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={`${client.country} · Commercial: ${client.commercialResponsible}`}
        actions={
          <div className="flex gap-2">
            <ClientFormDialog
              client={client}
              trigger={<Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Edit client</Button>}
            />
            <ProjectFormDialog
              defaultClientId={client.id}
              trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New project</Button>}
            />
          </div>
        }
      />
      <div className="px-6 py-5 grid gap-5 lg:grid-cols-3">
        <Card title="Contact">
          <dl className="space-y-1.5 text-sm">
            <Row label="Status" value={client.status ?? "—"} />
            <Row label="Contact person" value={client.contactPerson} />
            <Row label="Position" value={client.position} />
            <Row label="Email" value={client.email} />
            <Row label="Phone" value={client.phone} />
            <Row label="WhatsApp" value={client.whatsapp} />
            <Row label="Address" value={client.address} />
            <Row label="Commercial" value={client.commercialResponsible} />
          </dl>
          {client.notes && (
            <div className="mt-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</div>
              <p className="whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </Card>

        <Card title="Communication channels">
          <ul className="space-y-2 text-sm">
            {client.channels.length === 0 && <li className="text-muted-foreground">—</li>}
            {client.channels.map((ch, i) => {
              const Icon = ch.type === "Email" ? Mail : ch.type === "WhatsApp" ? MessageCircle : Phone;
              return (
                <li key={i} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-20 text-xs uppercase tracking-wide">{ch.type}</span>
                  <span>{ch.value}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Requirements memory">
          {client.requirementsMemory.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {client.requirementsMemory.map((r) => (
                <li key={r} className="rounded border border-border bg-muted/40 px-2 py-1 text-xs">{r}</li>
              ))}
            </ul>
          )}
        </Card>

        {client.status === "Lost" && (
          <Card title="Lost client memory" className="lg:col-span-3 border-red-500/30">
            <dl className="grid gap-2 md:grid-cols-2 text-sm">
              <Row label="Lost reason" value={client.lostReason} />
              <Row label="Lost notes" value={client.lostNotes} />
            </dl>
          </Card>
        )}

        <Card title={`Active projects (${active.length})`} className="lg:col-span-3">
          <ProjectList items={active} empty="No active projects." />
        </Card>

        <Card title={`Archived projects (${archived.length})`} className="lg:col-span-3">
          <ProjectList items={archived} empty="No archived projects." />
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function ProjectList({ items, empty }: { items: Project[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((p) => (
        <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
          <Link to="/products/$id" params={{ id: p.id }} className="hover:underline">
            <span className="font-medium">{p.product}</span>
            <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
          </Link>
          <StatusPill status={p.status} />
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}
