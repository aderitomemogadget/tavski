import { useI18n } from "@/lib/i18n";
import { pt, fr, enGB, es, de } from "date-fns/locale";
import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDate, parseIsoDate, toIsoDate, MIN_YEAR, MAX_YEAR } from "@/lib/dates";

const startMonth = new Date(MIN_YEAR, 0, 1);
const endMonth = new Date(MAX_YEAR, 11, 31);
const calendarLocales = { pt, fr, en: enGB, es, de };

/**
 * The single date component used across the whole application.
 * - Calendar-only entry, so impossible dates (31 September) cannot be typed.
 * - Year is chosen from a bounded dropdown, so 2002/2006 typos cannot happen.
 * - Value is built from local date parts, so the selected date is exactly the saved date.
 * - One display format everywhere (DD MMM YYYY).
 */
export function DateField({
  value,
  onChange,
  placeholder = "—",
  className,
  align = "start",
  clearable = true,
}: {
  value?: string;
  onChange: (iso: string | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  clearable?: boolean;
}) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-1.5 bg-transparent text-left text-sm tabular-nums",
            "border-b border-transparent py-0.5 outline-none transition-colors",
            "hover:border-border focus-visible:border-foreground/50",
            !selected && "text-muted-foreground/70",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{selected ? formatDate(value) : placeholder}</span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={t("Clear date")}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange(undefined);
              }}
              className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          locale={calendarLocales[language]}
          labels={{
            labelNext: () => t("Next month"),
            labelPrevious: () => t("Previous month"),
            labelMonthDropdown: () => t("Choose month"),
            labelYearDropdown: () => t("Choose year"),
          }}
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          startMonth={startMonth}
          endMonth={endMonth}
          captionLayout="dropdown"
          onSelect={(d) => {
            onChange(toIsoDate(d));
            setOpen(false);
          }}
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
