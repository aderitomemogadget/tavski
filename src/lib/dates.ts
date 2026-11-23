// Shared date validation, normalization and formatting for the whole app.
// One canonical storage format (ISO yyyy-mm-dd) and one display format
// (DD MMM YYYY) so no screen ever mixes DD/MM/YYYY with YYYY-MM-DD.

export const MIN_DATE = "2020-01-01";
export const MAX_DATE = "2099-12-31";

export const MIN_YEAR = 2020;
export const MAX_YEAR = 2099;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

// True only for a real calendar date (rejects 2026-09-31, 2025-02-30, …).
const isRealDate = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

// Repair legacy years produced by native date inputs (2026 typed/saved as 2006,
// 0026, 26, …). Anything before MIN_YEAR is shifted into the 20xx working range.
const repairYear = (input: number): number => {
  let y = input;
  if (y < 100) y += 2000;          // 26 -> 2026
  if (y >= 2000 && y < MIN_YEAR) y += 20; // 2006 -> 2026, 2007 -> 2027
  return y;
};

// Normalize an ISO date string. Repairs truncated / legacy years, rejects
// out-of-range years and impossible calendar dates. Returns undefined if invalid.
export const normalizeDateIso = (iso: string | undefined | null): string | undefined => {
  if (!iso) return undefined;
  const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(iso.trim());
  if (!m) return undefined;
  const y = repairYear(Number(m[1]));
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < MIN_YEAR || y > MAX_YEAR) return undefined;
  if (!isRealDate(y, mo, d)) return undefined;
  return `${y}-${pad(mo)}-${pad(d)}`;
};

/**
 * Deep-repair every ISO date string inside a loaded record so existing projects
 * display correctly without users editing each field. Full timestamps
 * (createdAt / archivedAt) are left untouched.
 */
export const repairDatesDeep = <T,>(value: T): T => {
  if (typeof value === "string") {
    if (/^\d{1,4}-\d{1,2}-\d{1,2}$/.test(value)) {
      return (normalizeDateIso(value) ?? value) as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(repairDatesDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = repairDatesDeep(v);
    }
    return out as unknown as T;
  }
  return value;
};


// Sanitize for controlled input display: hides malformed / out-of-range values.
export const safeDateValue = (iso: string | undefined | null): string =>
  normalizeDateIso(iso ?? "") ?? "";

// ISO string -> local Date (no timezone drift: the saved day is the picked day).
export const parseIsoDate = (iso: string | undefined | null): Date | undefined => {
  const n = normalizeDateIso(iso);
  if (!n) return undefined;
  const [y, m, d] = n.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Local Date -> ISO string, built from local parts so the selected date is
// exactly the stored date regardless of timezone.
export const toIsoDate = (date: Date | undefined | null): string | undefined => {
  if (!date || isNaN(date.getTime())) return undefined;
  return normalizeDateIso(
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  );
};

// Single display format used everywhere: 09 Mar 2026.
export const formatDate = (iso: string | undefined | null): string => {
  const n = normalizeDateIso(iso);
  if (!n) return "—";
  const [y, m, d] = n.split("-").map(Number);
  return `${pad(d)} ${MONTHS[m - 1]} ${y}`;
};

export const todayIso = (): string => toIsoDate(new Date())!;

// Shift Saturday/Sunday to the following Monday.
export const toBusinessDay = (iso: string): string => {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return toIsoDate(d) ?? iso;
};

// Whole calendar days from today to the target date (negative = in the past).
export const daysUntilDate = (iso: string | undefined | null): number | null => {
  const target = parseIsoDate(iso);
  if (!target) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
};

export type CountdownTone = "neutral" | "info" | "warn" | "danger";

export interface Countdown {
  days: number;
  label: string;
  tone: CountdownTone;
}

// "X days remaining" / "Due today" / "X days overdue"
export const deliveryCountdown = (iso: string | undefined | null): Countdown | null => {
  const days = daysUntilDate(iso);
  if (days === null) return null;
  if (days === 0) return { days, label: "Due today", tone: "danger" };
  if (days < 0) {
    const n = Math.abs(days);
    return { days, label: `${n} day${n === 1 ? "" : "s"} overdue`, tone: "danger" };
  }
  const tone: CountdownTone = days <= 7 ? "danger" : days <= 21 ? "warn" : "neutral";
  return { days, label: `${days} day${days === 1 ? "" : "s"} remaining`, tone };
};

// Reminder / Alert countdown: only today or overdue are surfaced as warnings.
export const reminderCountdown = (iso: string | undefined | null): Countdown | null => {
  const days = daysUntilDate(iso);
  if (days === null) return null;
  if (days === 0) return { days, label: "Reminder due today", tone: "danger" };
  if (days < 0) {
    const n = Math.abs(days);
    return { days, label: `${n} day${n === 1 ? "" : "s"} overdue`, tone: "danger" };
  }
  return { days, label: `${days} day${days === 1 ? "" : "s"} remaining`, tone: "neutral" };
};
