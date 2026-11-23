import { messages } from "./messages";

export const languages = [
  { code: "pt", label: "Português", locale: "pt-PT" },
  { code: "fr", label: "Français", locale: "fr-FR" },
  { code: "en", label: "English", locale: "en-GB" },
  { code: "es", label: "Español", locale: "es-ES" },
  { code: "de", label: "Deutsch", locale: "de-DE" },
] as const;

export type Language = (typeof languages)[number]["code"];
export type Variables = Record<string, string | number>;
export const languageStorageKey = "tavski.language";
const translationIndex = { pt: 0, fr: 1, es: 2, de: 3 } as const;
const dictionary: Record<string, readonly string[]> = messages;

export function isLanguage(value: unknown): value is Language {
  return languages.some(({ code }) => code === value);
}

export function detectLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const code = preference.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(code)) return code;
  }
  return "en";
}

export function localeFor(language: Language): string {
  return languages.find(({ code }) => code === language)!.locale;
}

export function translate(key: string, variables: Variables = {}, language: Language = "en"): string {
  const template = language === "en" ? key : dictionary[key]?.[translationIndex[language]] ?? key;
  // Replace only the source template's placeholders, never recursively translate user data.
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : placeholder,
  );
}

export function countLabel(noun: "day" | "project" | "client" | "event", count: number, language: Language): string {
  return translate(`{count} ${noun}${count === 1 ? "" : "s"}`, { count }, language);
}
