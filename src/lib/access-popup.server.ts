import { randomBytes } from "node:crypto";
import { detectLanguage, languages, translate, type Language } from "./i18n/core";

const popupKeys = ["Restricted access", "Enter the additional password to continue to Tavski.", "Access password", "Continue", "Checking…", "Incorrect access password.", "Too many attempts. Please try again later.", "Access verification unavailable. Please contact the administrator.", "Unable to verify access. Please try again.", "Language"];

// This function is serialized into the locked page. Keep it independent of module variables.
function popupClient() {
  const data = JSON.parse(document.getElementById("access-data")!.textContent!) as {
    endpoint: string; initialLanguage: string; unavailable: boolean;
    translations: Record<string, Record<string, string>>;
  };
  const select = document.getElementById("access-language") as HTMLSelectElement;
  const password = document.getElementById("access-password") as HTMLInputElement;
  const form = document.getElementById("access-form") as HTMLFormElement;
  const button = document.getElementById("access-submit") as HTMLButtonElement;
  const error = document.getElementById("access-error")!;
  let language = data.initialLanguage;
  let errorKey = data.unavailable ? "Access verification unavailable. Please contact the administrator." : "";
  let busy = false;
  const t = (key: string) => data.translations[language]?.[key] ?? key;
  const render = () => {
    document.documentElement.lang = language;
    document.title = `${t("Restricted access")} — Tavski`;
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n!); });
    select.setAttribute("aria-label", t("Language"));
    button.textContent = t(busy ? "Checking…" : "Continue");
    button.disabled = busy || data.unavailable;
    password.disabled = busy || data.unavailable;
    error.textContent = errorKey ? t(errorKey) : "";
    password.setAttribute("aria-invalid", errorKey ? "true" : "false");
  };
  try {
    const saved = localStorage.getItem("tavski.language");
    if (saved && Object.hasOwn(data.translations, saved)) language = saved;
    else {
      for (const preference of navigator.languages) {
        const code = preference.toLowerCase().split("-")[0];
        if (Object.hasOwn(data.translations, code)) { language = code; break; }
      }
    }
  } catch { /* Storage may be unavailable. */ }
  select.value = language;
  select.addEventListener("change", () => {
    language = select.value;
    try { localStorage.setItem("tavski.language", language); } catch { /* In-memory fallback. */ }
    render();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || data.unavailable) return;
    busy = true;
    errorKey = "";
    const value = password.value;
    render();
    try {
      const response = await fetch(data.endpoint, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: value }),
      });
      password.value = "";
      if (response.ok) { window.location.replace(window.location.href); return; }
      errorKey = response.status === 429 ? "Too many attempts. Please try again later."
        : response.status === 401 ? "Incorrect access password."
          : response.status === 503 ? "Access verification unavailable. Please contact the administrator."
            : "Unable to verify access. Please try again.";
    } catch { errorKey = "Unable to verify access. Please try again."; }
    busy = false;
    render();
    password.focus();
  });
  render();
  password.focus();
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function accessPopup(request: Request, basePath: string, unavailable = false): Response {
  const initialLanguage = detectLanguage((request.headers.get("accept-language") ?? "en").split(",").map((value) => value.split(";")[0].trim()));
  const t = (key: string) => escapeHtml(translate(key, {}, initialLanguage));
  const nonce = randomBytes(18).toString("base64");
  const translations = Object.fromEntries(languages.map(({ code }) => [code, Object.fromEntries(popupKeys.map((key) => [key, translate(key, {}, code as Language)]))]));
  const data = JSON.stringify({ endpoint: `${basePath}_access`, initialLanguage, unavailable, translations }).replace(/</g, "\\u003c");
  const options = languages.map(({ code, label }) => `<option value="${code}" lang="${code}"${code === initialLanguage ? " selected" : ""}>${code.toUpperCase()} · ${escapeHtml(label)}</option>`).join("");
  return new Response(`<!doctype html>
<html lang="${initialLanguage}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${t("Restricted access")} — Tavski</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif;color:#111827;background:#f8fafc}.backdrop{min-height:100dvh;padding:24px;display:grid;place-items:center;background:rgba(15,23,42,.13)}.popup{width:min(100%,420px);padding:28px;border:1px solid #e2e8f0;border-radius:12px;background:white;box-shadow:0 16px 50px #0f172a20}.language{display:flex;justify-content:flex-end;margin-bottom:24px}select,input,button{font:inherit;border-radius:6px}select{max-width:100%;padding:6px;border:1px solid #d1d5db;background:white}h1{font-size:20px;margin:0 0 8px}.brand{font-size:12px;letter-spacing:.12em;color:#64748b;margin-bottom:12px}p{color:#64748b;line-height:1.5;margin:0 0 24px}label{display:block;margin-bottom:8px}input{display:block;width:100%;padding:11px;border:1px solid #cbd5e1}button{width:100%;padding:11px;margin-top:8px;border:0;background:#111827;color:white;cursor:pointer}button:disabled{opacity:.6;cursor:wait}select:focus-visible,input:focus-visible,button:focus-visible{outline:2px solid #2563eb;outline-offset:3px}.error{min-height:40px;color:#b91c1c;padding-top:10px;font-size:13px;line-height:1.4}</style></head>
<body><main class="backdrop"><section class="popup" role="dialog" aria-modal="true" aria-labelledby="access-title" aria-describedby="access-description"><div class="language"><select id="access-language" aria-label="${t("Language")}">${options}</select></div><div class="brand">TAVSKI</div><h1 id="access-title" data-i18n="Restricted access">${t("Restricted access")}</h1><p id="access-description" data-i18n="Enter the additional password to continue to Tavski.">${t("Enter the additional password to continue to Tavski.")}</p><form id="access-form" method="post" action="${escapeHtml(basePath)}_access"><label for="access-password" data-i18n="Access password">${t("Access password")}</label><input id="access-password" type="password" name="password" autocomplete="current-password" required maxlength="128" aria-describedby="access-error"${unavailable ? " disabled" : ""}><div class="error" id="access-error" role="alert" aria-live="polite">${unavailable ? t("Access verification unavailable. Please contact the administrator.") : ""}</div><button id="access-submit" type="submit"${unavailable ? " disabled" : ""}>${t("Continue")}</button></form><noscript>${t("JavaScript is required.")}</noscript></section></main>
<script id="access-data" type="application/json" nonce="${nonce}">${data}</script><script nonce="${nonce}">(${popupClient.toString()})();</script></body></html>`, {
    status: unavailable ? 503 : 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", Vary: "Cookie",
      "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    },
  });
}
