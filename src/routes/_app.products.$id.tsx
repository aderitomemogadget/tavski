import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { StatusPill, DeptBadge } from "@/components/StatusPill";
import {
  useStore,
  PROJECT_STATUSES,
  DEPARTMENTS,
  type ProjectStatus,
  type Department,
  type TimelineEvent,
} from "@/lib/store";
import {
  daysSince,
  PACKAGING_COMPONENT_NAMES,
  TRANSPORT_MODES,
  type PackagingComponentName,
  type TransportMode,
} from "@/lib/mock-data";
import { ArrowRight, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";
import { ArchiveHistoryView } from "@/components/ArchiveHistory";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toBusinessDay, formatDate, deliveryCountdown, todayIso, daysUntilDate, reminderCountdown } from "@/lib/dates";
import { DateField } from "@/components/DateField";
import { deliveryDateOf } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/products/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Tavski` }] }),
  component: ProductPage,
});

const today = () => todayIso();





function ProductPage() {
  const { id } = Route.useParams();
  const {
    projects,
    clients,
    updateProject,
    changeProjectStatus,
    archiveProject,
    addTimelineEvent,
    updateTimelineEvent,
    removeTimelineEvent,
  } = useStore();
  const p = projects.find((x) => x.id === id);

  if (!p) {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        Project not found. <Link to="/products" className="underline">Back to products</Link>
      </div>
    );
  }

  // Archived projects are permanent history: render the read-only view, never the editable form.
  if (p.archived) {
    const archivedClient = clients.find((c) => c.id === p.clientId);
    return (
      <>
        <PageHeader
          title={p.product}
          subtitle={
            <>
              {archivedClient?.name}
              {archivedClient && " · "}
              {archivedClient?.country}
              {archivedClient && " · "}
              {p.sku} · Archived history
            </>
          }
        />
        <ArchiveHistoryView p={p} client={archivedClient} />
      </>
    );
  }


  const client = clients.find((c) => c.id === p.clientId);
  const days = p.bottleneck ? daysSince(p.bottleneck.since) : 0;
  const delivery = deliveryDateOf(p);
  const countdown = deliveryCountdown(delivery);
  const etaDays = countdown ? countdown.days : Infinity;
  const leadTimeExceeded = !!countdown && countdown.days < 0 && p.status !== "Delivered";
  const reminderDays = daysUntilDate(p.nextActionReminderDate);
  const reminderDue = reminderDays !== null && reminderDays <= 0;
  const totalQty = (p.orderedQuantity ?? 0) + (p.focQuantity ?? 0);

  const setPackaging = (name: PackagingComponentName, patch: Partial<NonNullable<typeof p.packagingComponents>[PackagingComponentName]>) => {
    const next = { ...(p.packagingComponents ?? {}) };
    next[name] = { ...(next[name] ?? {}), ...patch };
    updateProject(p.id, { packagingComponents: next });
  };

  return (
    <>
      <PageHeader
        title={p.product}
        subtitle={
          <>
            {client && (
              <Link to="/clients/$id" params={{ id: client.id }} className="hover:underline">{client.name}</Link>
            )}
            {client && " · "}{client?.country}{client && " · "}{p.sku}
          </>
        }
        actions={
          <div className="flex gap-2">
            <ProjectFormDialog
              project={p}
              trigger={<Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Edit project</Button>}
            />
            {!p.archived && (
              <Button
                size="sm"
                onClick={() => {
                  if (confirm("Mark this project as completed and move it to Archive?\n\nAll project memory (Overview, Timeline, Regulatory, Logistics, Documents) will be preserved.")) {
                    archiveProject(p.id);
                  }
                }}
              >
                Archive project
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 py-5">
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="memory">Project memory</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            {(etaDays <= 21 || leadTimeExceeded || reminderDue) && (
              <div className="space-y-2">
                {reminderDue && p.nextActionReminderDate && (
                  <Alert tone="danger" title={reminderDays === 0 ? "Reminder due today" : "Reminder overdue"}>
                    {formatDate(p.nextActionReminderDate)}
                    {reminderDays !== 0 && reminderDays !== null && (
                      <span className="ml-1">· {Math.abs(reminderDays)} day{Math.abs(reminderDays) === 1 ? "" : "s"} overdue</span>
                    )}
                  </Alert>
                )}
                {leadTimeExceeded && (
                  <Alert tone="danger" title="Production delivery overdue">
                    {formatDate(delivery)} has passed. Confirm current status with manufacturer.
                  </Alert>
                )}
                {etaDays <= 7 && etaDays !== Infinity && !leadTimeExceeded && p.nextActionReminderDate && (
                  <Alert tone="danger" title="Delivery in 7 days or less">
                    Confirm status with manufacturer. {countdown?.label} · {formatDate(delivery)}
                  </Alert>
                )}
                {etaDays > 7 && etaDays <= 14 && (
                  <Alert tone="warn" title="Delivery in 14 days">
                    Contact manufacturer for production update. {countdown?.label} · {formatDate(delivery)}
                  </Alert>
                )}
                {etaDays > 14 && etaDays <= 21 && (
                  <Alert tone="warn" title="Delivery approaching (21 days)">
                    Begin production follow-up. {countdown?.label} · {formatDate(delivery)}
                  </Alert>
                )}
              </div>
            )}


            <section className="rounded-lg border-2 border-foreground/10 bg-card p-5 space-y-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next action</div>
              <div className="flex items-start gap-3">
                <ArrowRight className="h-5 w-5 mt-0.5 text-foreground" />
                <input
                  className="w-full bg-transparent text-lg font-medium outline-none border-b border-transparent focus:border-border"
                  value={p.nextAction}
                  onChange={(e) => updateProject(p.id, { nextAction: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expected production delivery date</div>
                  <DateField
                    value={delivery}
                    onChange={(iso) => updateProject(p.id, { productionDeliveryDate: iso, nextActionDueDate: undefined })}
                  />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Reminder / alert</div>
                  <DateField
                    value={p.nextActionReminderDate}
                    onChange={(iso) =>
                      updateProject(p.id, { nextActionReminderDate: iso ? toBusinessDay(iso) : undefined })
                    }
                  />
                  <div className="text-[10px] text-muted-foreground">Weekends auto-shift to Monday.</div>
                </div>

              </div>
            </section>




            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Info label="Current status">
                <div className="flex items-center gap-2">
                  <StatusPill status={p.status} />
                  <Select value={p.status} onValueChange={(v) => changeProjectStatus(p.id, v as ProjectStatus)}>
                    <SelectTrigger className="h-7 w-auto text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </Info>




              <Info label="Responsible">
                <input
                  className="w-full bg-transparent outline-none border-b border-transparent focus:border-border"
                  value={p.responsiblePerson}
                  onChange={(e) => updateProject(p.id, { responsiblePerson: e.target.value })}
                />
                <div className="text-xs text-muted-foreground mt-1">{p.responsibleDepartment}</div>
              </Info>

              {p.status !== "Delivered" && (
                <>
                  <Info label="Lead time (days)">
                    <input
                      type="number"
                      className="w-full bg-transparent outline-none border-b border-transparent focus:border-border"
                      value={p.leadTimeDays}
                      onChange={(e) => updateProject(p.id, { leadTimeDays: Number(e.target.value) || 0 })}
                    />
                  </Info>

                  <Info label="Actual production completion date" className="tabular-nums">
                    <DateField
                      value={p.actualProductionCompletionDate}
                      onChange={(iso) => updateProject(p.id, { actualProductionCompletionDate: iso })}
                    />
                  </Info>
                </>
              )}


            </div>

            <MemorySection title="Order information">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MemoryRow label="Customer PO reference" value={p.customerPoReference} onChange={(v) => updateProject(p.id, { customerPoReference: v })} />
                <MemoryRow label="Order reference number" value={p.orderReferenceNumber} onChange={(v) => updateProject(p.id, { orderReferenceNumber: v })} />
                <MemoryRow label="Order / shipment reference" value={p.shipmentReference} onChange={(v) => updateProject(p.id, { shipmentReference: v })} />
                <MemoryRow label="SKU" value={p.sku} onChange={(v) => updateProject(p.id, { sku: v })} />
                <MemoryRow label="Ordered quantity" type="number" value={p.orderedQuantity?.toString()} onChange={(v) => updateProject(p.id, { orderedQuantity: v === "" ? undefined : Number(v) })} />
                <MemoryRow label="FOC quantity" type="number" value={p.focQuantity?.toString()} onChange={(v) => updateProject(p.id, { focQuantity: v === "" ? undefined : Number(v) })} />
                <MemoryRow label="Actual produced quantity" type="number" value={p.actualProducedQuantity?.toString()} onChange={(v) => updateProject(p.id, { actualProducedQuantity: v === "" ? undefined : Number(v) })} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Total units ordered: <span className="font-medium text-foreground tabular-nums">{totalQty || "—"}</span>
              </div>
            </MemorySection>
          </TabsContent>

          <TabsContent value="memory" className="space-y-3">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Critical project memory so you don't have to dig through emails, WhatsApp threads,
              contracts or shared folders the next time this client reorders.
            </p>

            <MemorySection title="Commercial memory">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MemoryRow label="Commercial responsible" value={p.commercialResponsible} onChange={(v) => updateProject(p.id, { commercialResponsible: v })} />
                <MemoryRow label="Last price" value={p.lastPrice} onChange={(v) => updateProject(p.id, { lastPrice: v })} />
                <MemoryRow label="Currency" value={p.currency} onChange={(v) => updateProject(p.id, { currency: v })} />
                <MemoryRow label="Payment terms" value={p.paymentTerms} onChange={(v) => updateProject(p.id, { paymentTerms: v })} />
                <MemoryRow label="Advance payment date" type="date" value={p.advancePaymentDate} onChange={(v) => updateProject(p.id, { advancePaymentDate: v })} />
                <MemoryRow label="Advance payment amount" value={p.advancePaymentAmount} onChange={(v) => updateProject(p.id, { advancePaymentAmount: v })} />
                <YesNoRow
                  label="Advance payment received"
                  value={p.advancePaymentReceived}
                  onChange={(v) => updateProject(p.id, { advancePaymentReceived: v })}
                />
              </div>
            </MemorySection>

            <MemorySection title="Regulatory memory — Packaging components">
              <p className="text-xs text-muted-foreground">
                Components are often approved separately at different dates. Track each one independently.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Component</th>
                      <th className="py-2 pr-3 font-medium">Version</th>
                      <th className="py-2 pr-3 font-medium">Approval date</th>
                      <th className="py-2 pr-3 font-medium">Reference code</th>
                      <th className="py-2 font-medium">Folder location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PACKAGING_COMPONENT_NAMES.map((name) => {
                      const c = p.packagingComponents?.[name] ?? {};
                      return (
                        <tr key={name} className="border-t border-border">
                          <td className="py-2 pr-3 font-medium">{name}</td>
                          <td className="py-2 pr-3">
                            <CellInput value={c.version} onChange={(v) => setPackaging(name, { version: v })} />
                          </td>
                          <td className="py-2 pr-3">
                            <CellInput type="date" value={c.approvalDate} onChange={(v) => setPackaging(name, { approvalDate: v })} />
                          </td>
                          <td className="py-2 pr-3">
                            <CellInput value={c.referenceCode} onChange={(v) => setPackaging(name, { referenceCode: v })} />
                          </td>
                          <td className="py-2">
                            <CellInput value={c.folderLocation} onChange={(v) => setPackaging(name, { folderLocation: v })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </MemorySection>

            <MemorySection title="Regulatory memory — Additional">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MemoryRow label="TDS reference code" value={p.tdsReferenceCode} onChange={(v) => updateProject(p.id, { tdsReferenceCode: v })} />
                <MemoryRow label="Registration number (optional)" value={p.registrationNumber} onChange={(v) => updateProject(p.id, { registrationNumber: v })} />
                <MemoryRow label="Folder location" value={p.regulatoryFolderLocation} onChange={(v) => updateProject(p.id, { regulatoryFolderLocation: v })} />
                <MemoryRow label="Regulatory notes" multiline value={p.regulatoryNotes} onChange={(v) => updateProject(p.id, { regulatoryNotes: v })} />
              </div>
            </MemorySection>

            <MemorySection title="Operational memory">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MemoryRow label="Pharmaceutical form" value={p.pharmaceuticalForm} onChange={(v) => updateProject(p.id, { pharmaceuticalForm: v })} />
                <MemoryRow label="Presentation" value={p.presentation} onChange={(v) => updateProject(p.id, { presentation: v })} />
                <MemoryRow label="Manufacturer" value={p.manufacturer} onChange={(v) => updateProject(p.id, { manufacturer: v })} />
                <MemoryRow label="Manufacturer contact" value={p.manufacturerContact} onChange={(v) => updateProject(p.id, { manufacturerContact: v })} />
                <MemoryRow label="Manufacturer email" value={p.manufacturerEmail} onChange={(v) => updateProject(p.id, { manufacturerEmail: v })} />
                <MemoryRow label="Manufacturer WhatsApp" value={p.manufacturerWhatsapp} onChange={(v) => updateProject(p.id, { manufacturerWhatsapp: v })} />
                <MemoryRow label="Quotation offer number" value={p.quotationOfferNumber} onChange={(v) => updateProject(p.id, { quotationOfferNumber: v })} />
                <MemoryRow label="Quotation date" type="date" value={p.quotationDate} onChange={(v) => updateProject(p.id, { quotationDate: v })} />
                <MemoryRow label="Standard lead time (days)" type="number" value={String(p.leadTimeDays)} onChange={(v) => updateProject(p.id, { leadTimeDays: Number(v) || 0 })} />
                <MemoryRow label="Operational notes" multiline value={p.operationalNotes} onChange={(v) => updateProject(p.id, { operationalNotes: v })} />
              </div>
            </MemorySection>

            <MemorySection title="Current bottleneck">
              <p className="text-xs text-muted-foreground">
                Free-text description of what is blocking progress today. Leave empty when nothing is blocked.
              </p>
              <textarea
                rows={3}
                value={p.bottleneck?.description ?? ""}
                placeholder="e.g. Awaiting ministry approval on artwork v3 — expected next week."
                onChange={(e) => {
                  const desc = e.target.value;
                  if (!desc.trim()) {
                    updateProject(p.id, { bottleneck: undefined });
                  } else {
                    updateProject(p.id, {
                      bottleneck: {
                        department: p.bottleneck?.department ?? p.responsibleDepartment,
                        description: desc,
                        since: p.bottleneck?.since ?? today(),
                      },
                    });
                  }
                }}
                className="w-full bg-transparent text-sm border border-border rounded-md p-2 focus:outline-none focus:border-foreground/30 resize-none"
              />
            </MemorySection>

            <MemorySection title="Logistics memory">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Transport mode</div>
                  <Select value={p.transportMode ?? ""} onValueChange={(v) => updateProject(p.id, { transportMode: v as TransportMode })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <YesNoRow
                  label="Temperature controlled"
                  value={p.temperatureControlled}
                  onChange={(v) => updateProject(p.id, { temperatureControlled: v })}
                />
                <MemoryRow label="Incoterm" value={p.incoterm} onChange={(v) => updateProject(p.id, { incoterm: v })} />
                <MemoryRow label="Goods available at" value={p.goodsAvailableAt} onChange={(v) => updateProject(p.id, { goodsAvailableAt: v })} />
                <MemoryRow label="Consignee" value={p.consignee} onChange={(v) => updateProject(p.id, { consignee: v })} />
                <MemoryRow label="Notify party" value={p.notifyParty} onChange={(v) => updateProject(p.id, { notifyParty: v })} />
                <MemoryRow label="Port of loading" value={p.portOfLoading} onChange={(v) => updateProject(p.id, { portOfLoading: v })} />
                <MemoryRow label="Port of destination" value={p.portOfDestination} onChange={(v) => updateProject(p.id, { portOfDestination: v })} />
                <MemoryRow label="Logistics notes" multiline value={p.logisticsNotes} onChange={(v) => updateProject(p.id, { logisticsNotes: v })} />
              </div>
            </MemorySection>

            <MemorySection title="Document references">
              <p className="text-xs text-muted-foreground">
                Folder paths / links to originals. Store the files in your preferred cloud (OneDrive, Google Drive, Dropbox, SharePoint) — no duplication needed.
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MemoryRow label="Packing List" value={p.packingListLocation} onChange={(v) => updateProject(p.id, { packingListLocation: v })} />
                <MemoryRow label="Invoice" value={p.invoiceLocation} onChange={(v) => updateProject(p.id, { invoiceLocation: v })} />
                <MemoryRow label="CoA" value={p.coaLocation} onChange={(v) => updateProject(p.id, { coaLocation: v })} />
                <MemoryRow label="COO (Certificate of Origin)" value={p.cooLocation} onChange={(v) => updateProject(p.id, { cooLocation: v })} />
                <MemoryRow label="DU (HS Code)" value={p.duLocation} onChange={(v) => updateProject(p.id, { duLocation: v })} />
                <MemoryRow label="EUR-1" value={p.eur1Location} onChange={(v) => updateProject(p.id, { eur1Location: v })} />
                <MemoryRow label="Health Certificate / FSC" value={p.healthCertificateLocation} onChange={(v) => updateProject(p.id, { healthCertificateLocation: v })} />
                <MemoryRow label="AWB" value={p.awbLocation} onChange={(v) => updateProject(p.id, { awbLocation: v })} />
                <YesNoRow label="Insurance" value={p.insurance} onChange={(v) => updateProject(p.id, { insurance: v })} />
                <MemoryRow label="Others" multiline value={p.otherDocumentLocation} onChange={(v) => updateProject(p.id, { otherDocumentLocation: v })} />
              </div>
            </MemorySection>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground max-w-2xl">
                Timeline is operational memory — record every meaningful event, comment and next action.
              </p>
              <Button
                size="sm"
                onClick={() =>
                  addTimelineEvent(p.id, {
                    date: today(),
                    department: p.responsibleDepartment,
                    responsible: p.responsiblePerson,
                    status: "New event",
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add event
              </Button>
            </div>

            <section className="rounded-lg border border-border bg-card">
              {p.timeline.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">No events yet.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {p.timeline
                    .map((e, i) => ({ e, i }))
                    .slice()
                    .reverse()
                    .map(({ e, i }) => (
                      <TimelineRow
                        key={i}
                        event={e}
                        onChange={(patch) => updateTimelineEvent(p.id, i, patch)}
                        onRemove={() => removeTimelineEvent(p.id, i)}
                      />
                    ))}
                </ul>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function TimelineRow({
  event,
  onChange,
  onRemove,
}: {
  event: TimelineEvent;
  onChange: (patch: Partial<TimelineEvent>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(!!event.comment || !!event.nextAction);
  return (
    <li className="px-4 py-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-[120px_140px_1fr_160px_auto] gap-2 items-center">
        <DateField value={event.date} onChange={(iso) => onChange({ date: iso ?? event.date })} clearable={false} />

        <Select value={event.department} onValueChange={(v) => onChange({ department: v as Department })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <input
          value={event.status}
          placeholder="Status / event"
          onChange={(e) => onChange({ status: e.target.value })}
          className="h-8 bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-border"
        />
        <input
          value={event.responsible}
          placeholder="Responsible"
          onChange={(e) => onChange({ responsible: e.target.value })}
          className="h-8 bg-transparent text-sm outline-none border-b border-transparent focus:border-border"
        />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded((x) => !x)}>
            {expanded ? "Hide" : "Notes"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-1">
          <textarea
            rows={2}
            value={event.comment ?? ""}
            placeholder="Notes / comment"
            onChange={(e) => onChange({ comment: e.target.value })}
            className="w-full bg-transparent text-sm border border-border rounded-md p-2 focus:outline-none focus:border-foreground/30 resize-none"
          />
          <textarea
            rows={2}
            value={event.nextAction ?? ""}
            placeholder="Next action"
            onChange={(e) => onChange({ nextAction: e.target.value })}
            className="w-full bg-transparent text-sm border border-border rounded-md p-2 focus:outline-none focus:border-foreground/30 resize-none"
          />
        </div>
      )}
    </li>
  );
}

function Alert({ tone, title, children }: { tone: "warn" | "danger"; title: string; children: React.ReactNode }) {
  const cls = tone === "danger"
    ? "border-danger/40 bg-danger/10 text-danger"
    : "border-warn/40 bg-warn/10 text-warn";
  return (
    <div className={`rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${cls}`}>
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="opacity-80">{children}</div>
      </div>
    </div>
  );
}

function Info({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

function MemorySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="p-4 space-y-2.5">{children}</div>
    </div>
  );
}

function MemoryRow({
  label, value, onChange, type = "text", multiline = false,
}: { label: string; value?: string; onChange: (v: string) => void; type?: "text" | "date" | "number"; multiline?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {multiline ? (
        <textarea
          value={value ?? ""}
          placeholder="—"
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border placeholder:text-muted-foreground/60 resize-none"
        />
      ) : type === "date" ? (
        <DateField value={value} onChange={(iso) => onChange(iso ?? "")} />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border placeholder:text-muted-foreground/60"
        />
      )}
    </div>
  );
}

function CellInput({ value, onChange, type = "text" }: { value?: string; onChange: (v: string) => void; type?: "text" | "date" }) {
  if (type === "date") {
    return (
      <DateField value={value} onChange={(iso) => onChange(iso ?? "")} />
    );
  }
  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder="—"
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border placeholder:text-muted-foreground/60"
    />
  );
}


function YesNoRow({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <Select value={value === undefined ? "" : value ? "yes" : "no"} onValueChange={(v) => onChange(v === "yes")}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
