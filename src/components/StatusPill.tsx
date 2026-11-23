import { useI18n } from "@/lib/i18n";
import { deliveryCountdown } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ProjectStatus, Department } from "@/lib/mock-data";

/**
 * Status pill — refined for Tavski.
 * Uses a small leading dot to encode tone, keeps the label neutral for
 * a calmer table. Semantic tone tokens preserved.
 */
const statusTone: Record<ProjectStatus, { dot: string; text: string }> = {
  "Preparing Documents": { dot: "bg-muted-foreground/50", text: "text-foreground" },
  "Under Registration":  { dot: "bg-muted-foreground/50", text: "text-foreground" },
  "Order Confirmed":     { dot: "bg-muted-foreground/50", text: "text-foreground" },
  "Awaiting Payment":    { dot: "bg-warn", text: "text-foreground" },
  "In Production":       { dot: "bg-info", text: "text-foreground" },
  "Production Delayed":  { dot: "bg-danger", text: "text-foreground" },
  "Artwork Review":      { dot: "bg-warn", text: "text-foreground" },
  "Ready to Ship":       { dot: "bg-info", text: "text-foreground" },
  "In Transit":          { dot: "bg-info", text: "text-foreground" },
  Delivered:             { dot: "bg-success", text: "text-foreground" },
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  const tone = statusTone[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium leading-none",
        tone.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {t(status)}
    </span>
  );
}

const deptTone: Record<Department, string> = {
  Client: "border-border text-muted-foreground",
  Regulatory: "border-border text-muted-foreground",
  Production: "border-border text-muted-foreground",
  Logistics: "border-border text-muted-foreground",
  Finance: "border-border text-muted-foreground",
};

export function DeptBadge({ dept }: { dept: Department }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
        deptTone[dept],
      )}
    >
      {t(dept)}
    </span>
  );
}

/** Day indicator driven by the Production Delivery Date. */
export function DeliveryBadge({ iso }: { iso?: string }) {
  const { language } = useI18n();
  const c = deliveryCountdown(iso, language);
  if (!c) return <span className="text-[11px] text-muted-foreground">—</span>;
  const tone =
    c.tone === "danger"
      ? "bg-danger-soft text-danger border-danger/20"
      : c.tone === "warn"
        ? "bg-warn-soft text-warn border-warn/20"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums whitespace-nowrap",
        tone,
      )}
    >
      {c.label}
    </span>
  );
}
