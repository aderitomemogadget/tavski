// Run: node --test tests/i18n.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Load the pure TypeScript modules using the project's existing compiler.
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const { languages, translate, countLabel, detectLanguage, languageStorageKey } = require("../src/lib/i18n/core.ts");
const { messages } = require("../src/lib/i18n/messages.ts");

test("all four translated catalogs cover every source key and preserve placeholders", () => {
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [source, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 4, source);
    for (const translated of translations) {
      assert.ok(translated.trim(), source);
      assert.deepEqual(placeholders(translated), placeholders(source), source);
    }
  }
});

test("all literal UI translation keys exist", () => {
  const missing = new Set();
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
  );
  for (const file of walk(path.join(__dirname, "../src"))) {
    if (!/\.(ts|tsx)$/.test(file) || file.includes(`${path.sep}i18n${path.sep}`)) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ["t", "translate", "translateCurrent"].includes(node.expression.getText(source))) {
        const collect = (argument) => {
          if (!argument) return;
          if (ts.isStringLiteral(argument) && !Object.hasOwn(messages, argument.text)) missing.add(argument.text);
          if (ts.isConditionalExpression(argument)) { collect(argument.whenTrue); collect(argument.whenFalse); }
        };
        collect(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual([...missing], []);
});

test("supported browser languages, regional variants and fallback", () => {
  assert.deepEqual(languages.map(({ code }) => code), ["pt", "fr", "en", "es", "de"]);
  assert.equal(detectLanguage(["nl-NL", "pt-PT"]), "pt");
  assert.equal(detectLanguage(["DE-de"]), "de");
  assert.equal(detectLanguage(["fr_CA"]), "fr");
  assert.equal(detectLanguage(["ja"]), "en");
});

test("persisted enum values have labels in every language", () => {
  const names = new Set(["CLIENT_STATUSES", "LOST_REASONS", "PACKAGING_COMPONENT_NAMES", "TRANSPORT_MODES", "PROJECT_STATUSES", "DEPARTMENTS"]);
  const found = new Set();
  for (const relative of ["src/lib/store.tsx", "src/lib/mock-data.ts"]) {
    const file = path.join(__dirname, "..", relative);
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && names.has(node.name.getText(source)) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
        found.add(node.name.getText(source));
        for (const item of node.initializer.elements) {
          assert.ok(Object.hasOwn(messages, item.text), `Missing enum translation: ${item.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.equal(found.size, names.size);
});

test("plural counts, English source fallback and unmodified user data", () => {
  assert.equal(countLabel("client", 1, "de"), "1 Kunde");
  assert.equal(countLabel("client", 2, "de"), "2 Kunden");
  assert.equal(countLabel("project", 0, "pt"), "0 projetos");
  assert.equal(translate("Dashboard", {}, "en"), "Dashboard");
  assert.equal(translate("Customer-supplied text", {}, "fr"), "Customer-supplied text");
  assert.equal(translate("{country} · Commercial: {name}", { country: "France", name: "{count} & <Acme>" }, "pt"), "France · Comercial: {count} & <Acme>");
});

test("language preference persists, invalid input is ignored and blocked storage is tolerated", () => {
  const values = new Map([[languageStorageKey, "es"]]);
  global.window = {
    navigator: { languages: ["fr-FR"] },
    localStorage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) },
  };
  const store = require("../src/lib/i18n/index.ts");
  assert.equal(store.getLanguage(), "es");
  store.setLanguage("de");
  assert.equal(values.get(languageStorageKey), "de");
  assert.equal(store.getLanguage(), "de");
  store.setLanguage("invalid");
  assert.equal(store.getLanguage(), "de");
  window.localStorage.setItem = () => { throw new Error("Storage blocked"); };
  assert.doesNotThrow(() => store.setLanguage("pt"));
  assert.equal(store.getLanguage(), "pt");
  delete global.window;
  assert.equal(store.getLanguage(), "en", "SSR cannot inherit a browser preference");
});

test("dates and reminders use the selected locale without changing the ISO day", () => {
  const { formatDate, deliveryCountdown, todayIso } = require("../src/lib/dates.ts");
  const iso = "2026-03-09";
  assert.match(formatDate(iso, "pt"), /mar/);
  assert.match(formatDate(iso, "fr"), /mars/);
  assert.match(formatDate(iso, "en"), /Mar/);
  assert.match(formatDate(iso, "es"), /mar/);
  assert.match(formatDate(iso, "de"), /Mär/);
  for (const { code } of languages) {
    assert.match(formatDate(iso, code), /09/);
    assert.match(formatDate(iso, code), /2026/);
  }
  assert.equal(deliveryCountdown(todayIso(), "pt").label, "Termina hoje");
  assert.equal(deliveryCountdown(todayIso(), "fr").label, "Échéance aujourd’hui");
  assert.equal(deliveryCountdown(undefined, "de"), null);
});
