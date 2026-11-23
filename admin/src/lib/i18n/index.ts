import { useCallback, useSyncExternalStore } from "react";
import { countLabel, detectLanguage, isLanguage, languageStorageKey, localeFor, translate, type Language, type Variables } from "./core";

export { languages, languageStorageKey, type Language } from "./core";
let currentLanguage: Language | undefined;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  // Server snapshots are fixed, independent of another visitor's language.
  if (typeof window === "undefined") return "en";
  if (currentLanguage) return currentLanguage;
  try {
    const stored = window.localStorage.getItem(languageStorageKey);
    if (isLanguage(stored)) return (currentLanguage = stored);
  } catch { /* Private browsing may disable storage. Selection still works. */ }
  return (currentLanguage = detectLanguage(window.navigator.languages ?? [window.navigator.language]));
}

export function setLanguage(language: Language): void {
  if (!isLanguage(language) || typeof window === "undefined") return;
  currentLanguage = language;
  try { window.localStorage.setItem(languageStorageKey, language); } catch { /* In-memory fallback. */ }
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== languageStorageKey && event.key !== null) return;
  currentLanguage = undefined;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = (): Language => "en";

// For asynchronous notifications and date utilities outside React.
export const translateCurrent = (key: string, variables?: Variables) => translate(key, variables, getLanguage());

export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLanguage, getServerSnapshot);
  const t = useCallback((key: string, variables?: Variables) => translate(key, variables, language), [language]);
  const count = useCallback((noun: "day" | "project" | "client" | "event", value: number) => countLabel(noun, value, language), [language]);
  return { language, locale: localeFor(language), setLanguage, t, count };
}
