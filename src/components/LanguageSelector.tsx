import { Languages } from "lucide-react";
import { languages, useI18n, type Language } from "@/lib/i18n";

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Languages aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {languages.map(({ code, label }) => <option key={code} value={code} lang={code}>{code.toUpperCase()} · {label}</option>)}
      </select>
    </label>
  );
}
