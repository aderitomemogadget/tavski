import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { StatusPill, DeptBadge, DeliveryBadge } from "@/components/StatusPill";
import { useProjects, useStore } from "@/lib/store";
import { daysSince, deliveryDateOf } from "@/lib/mock-data";
import { deliveryCountdown, daysUntilDate, formatDate, reminderCountdown } from "@/lib/dates";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tavski" },
      { name: "description", content: "What needs attention, what is blocked, what is next." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t, count } = useI18n();
  const allProjects = useProjects();
  const { clients } = useStore();
  const getClient = (id: string) => clients.find((c) => c.id === id);

  const rows = allProjects
    .filter((p) => !p.archived)
    .map((p) => {
      const days = p.bottleneck ? daysSince(p.bottleneck.since) : 0;
      const delivery = deliveryDateOf(p);
      const countdown = deliveryCountdown(delivery);
      const etaDays = countdown ? countdown.days : Infinity;
      const etaApproaching = etaDays <= 21;
      const eta14 = etaDays <= 14;
      const eta7 = etaDays <= 7;
      const leadTimeExceeded = !!countdown && countdown.days < 0 && p.status !== "Delivered";
      const reminderDays = daysUntilDate(p.nextActionReminderDate);
      const reminderDue = reminderDays !== null && reminderDays <= 0;
      return { p, days, delivery, countdown, etaDays, etaApproaching, eta14, eta7, leadTimeExceeded, reminderDue, reminderDays };
    })
    .sort((a, b) => b.days - a.days);


  // Attention Required when ANY of three independent triggers is true:
  // 1. active bottleneck
  // 2. Reminder / Alert due (today or overdue) — independent of delivery date
  // 3. automatic production-delivery warning (21/14/7-day window) — only when a
  //    Reminder / Alert is set (matches the banner visibility rules), plus the
  //    overdue case which is always a real alert. Status alone never triggers.
  const attention = rows.filter(
    (r) => r.p.bottleneck || r.reminderDue || r.leadTimeExceeded || (!!r.p.nextActionReminderDate && r.etaApproaching),
  );
  const blocked = rows.filter((r) => r.p.bottleneck).length;

  return (
    <>
      <PageHeader
        title={t("Dashboard")}
        subtitle={t("What's happening, who owns it, where it's stuck.")}
        actions={
          <ProjectFormDialog
            trigger={
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t("New project")}</Button>
            }
          />
        }
      />

      <div className="px-6 pt-6 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Stat
          label={t("Active projects")}
          value={rows.length}
          hint={rows.length === 0 ? t("Nothing in motion") : t("{count} progressing", { count: rows.length - blocked })}
        />
        <Stat
          label={t("Bottlenecks")}
          value={blocked}
          tone={blocked === 0 ? undefined : "warn"}
          hint={blocked === 0 ? t("All clear") : t("{count} of {total} blocked", { count: blocked, total: rows.length })}
        />
      </div>

      <section className="px-6 pt-6 pb-8">
        <div className="flex items-baseline gap-2.5 mb-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
            {t("Attention Required")}{" "}</h2>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {count("project", attention.length)}
          </span>
        </div>

        {attention.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center">
            <div className="mx-auto h-1.5 w-1.5 rounded-full bg-success" />
            <div className="mt-4 text-[13px] font-medium text-foreground tracking-tight">{t("No active bottlenecks")}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">{t("All projects are progressing on schedule.")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {attention.map(({ p, days, delivery, countdown, etaDays, etaApproaching, eta14, eta7, leadTimeExceeded, reminderDue, reminderDays }) => {
              const client = getClient(p.clientId);
              if (!client) return null;
              const reminder = reminderDue && p.nextActionReminderDate ? reminderCountdown(p.nextActionReminderDate) : null;
              return (
                <Link
                  key={p.id}
                  to="/products/$id"
                  params={{ id: p.id }}
                  className="group rounded-lg border border-border bg-card hover:border-danger/50 hover:shadow-sm transition-all overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{client.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {client.country} · {p.product}
                      </div>
                    </div>
                    {p.nextActionReminderDate && <DeliveryBadge iso={delivery} />}
                  </div>
                  <div className="px-4 py-3 space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={p.status} />
                      {p.bottleneck && <DeptBadge dept={p.bottleneck.department} />}
                    </div>
                    {p.bottleneck && <Field label={t("Bottleneck")} value={p.bottleneck.description} />}
                    {reminder && (
                      <AlertBox tone="danger" title={reminderDays === 0 ? t("Reminder due today") : t("Reminder overdue")}>
                        {formatDate(p.nextActionReminderDate!)}
                        {reminderDays !== 0 && reminderDays !== null && (
                          <span className="ml-1">· {t(Math.abs(reminderDays) === 1 ? "{count} day overdue" : "{count} days overdue", { count: Math.abs(reminderDays) })}</span>
                        )}
                      </AlertBox>
                    )}
                    {leadTimeExceeded && (
                      <AlertBox tone="danger" title={t("Production delivery overdue")}>
                        {formatDate(delivery)} {t("has passed. Confirm status with manufacturer.")}{" "}</AlertBox>
                    )}
                    {eta7 && etaDays !== Infinity && !leadTimeExceeded && p.nextActionReminderDate && (
                      <AlertBox tone="danger" title={t("Delivery in 7 days or less")}>
                        {t("Confirm status with manufacturer.")}{" "}{countdown?.label} · {formatDate(delivery)}
                      </AlertBox>
                    )}
                    {eta14 && !eta7 && (
                      <AlertBox tone="warn" title={t("Delivery in 14 days")}>
                        {t("Contact manufacturer for production update.")}{" "}{countdown?.label} · {formatDate(delivery)}
                      </AlertBox>
                    )}
                    {etaApproaching && !eta14 && (
                      <AlertBox tone="warn" title={t("Delivery approaching (21 days)")}>
                        {t("Begin production follow-up.")}{" "}{countdown?.label} · {formatDate(delivery)}
                      </AlertBox>
                    )}
                    <Field label={t("Next action")} value={p.nextAction} emphasis />
                  </div>
                  <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-end text-xs text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>

              );
            })}
          </div>
        )}
      </section>

      <section className="px-6 pb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground mb-4">
          {t("All active projects")}{" "}</h2>
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-left">
                  <Th>{t("Client")}</Th><Th>{t("Country")}</Th><Th>{t("Product")}</Th><Th>{t("Status")}</Th>
                  <Th>{t("Bottleneck")}</Th><Th>{t("Responsible")}</Th>
                  <Th>{t("Next action")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, days }) => {
                  const client = getClient(p.clientId);
                  if (!client) return null;
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <Td>
                        <Link to="/clients/$id" params={{ id: client.id }} className="font-medium hover:underline">
                          {client.name}
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{client.country}</Td>
                      <Td>
                        <Link to="/products/$id" params={{ id: p.id }} className="hover:underline">{p.product}</Link>
                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                      </Td>
                      <Td><StatusPill status={p.status} /></Td>
                      <Td>
                        {p.bottleneck ? (
                          <div className="flex flex-col gap-1">
                            <DeptBadge dept={p.bottleneck.department} />
                            <span className="text-xs text-muted-foreground">{p.bottleneck.description}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </Td>
                      <Td>
                        <div>{p.responsiblePerson}</div>
                        <div className="text-xs text-muted-foreground">{t(p.responsibleDepartment)}</div>
                      </Td>
                      <Td className="max-w-[260px] text-muted-foreground">{p.nextAction}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={emphasis ? "text-sm font-medium text-foreground" : "text-sm text-foreground"}>{value}</div>
    </div>
  );
}
function AlertBox({ tone, title, children }: { tone: "warn" | "danger"; title: string; children: React.ReactNode }) {
  const cls = tone === "danger" ? "border-danger/40 bg-danger/10 text-danger" : "border-warn/40 bg-warn/10 text-warn";
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
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-top ${className}`}>{children}</td>;
}
function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: "warn" | "danger" | "info"; hint?: string }) {
  const toneCls = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "info" ? "text-info" : "text-foreground";
  const dotCls = tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : tone === "info" ? "bg-info" : "bg-success";
  return (
    <div className="group rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      </div>
      <div className={`mt-3 text-[32px] font-semibold tabular-nums leading-none tracking-[-0.02em] ${toneCls}`}>{value}</div>
      {hint && <div className="mt-2.5 text-[11px] text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}
