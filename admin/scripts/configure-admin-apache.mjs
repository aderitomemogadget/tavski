#!/usr/bin/env node
import { readFile, writeFile, mkdir, copyFile, rename, stat, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const vhostPath = "/etc/apache2/sites-enabled/dev3.memogadget.com-le-ssl.conf";
const includePath = "/etc/apache2/tavski/admin.conf";
const includeLine = `    Include ${includePath}`;

export function rewriteApache(source) {
  if ((source.match(/^\s*<VirtualHost\b/gmi) ?? []).length !== 1
    || !/^\s*ServerName\s+dev3\.memogadget\.com\s*$/mi.test(source)) {
    throw new Error("O ficheiro não contém exclusivamente o VirtualHost esperado do DEV3.");
  }
  if (source.includes(`Include ${includePath}`)) {
    if (/^\s*ProxyPass(?:Reverse)?\s+"?\/tavski\/(?:"|\s)/mi.test(source)) throw new Error("Configuração parcial: ainda existe proxy na raiz.");
    return source;
  }
  const patterns = [
    /^\s*ProxyPass "\/tavski\/assets\/" "!"\s*$/m,
    /^\s*Alias "\/tavski\/assets\/" "\/home\/www\/dev3\.memogadget\.com\/public_html\/tavski\/\.output\/public\/assets\/"\s*$/m,
    /^\s*<Directory "\/home\/www\/dev3\.memogadget\.com\/public_html\/tavski\/\.output\/public\/assets">[\s\S]*?<\/Directory>\s*$/m,
    /^\s*ProxyPass "\/tavski\/" "http:\/\/127\.0\.0\.1:3103\/tavski\/"\s*$/m,
    /^\s*ProxyPassReverse "\/tavski\/" "http:\/\/127\.0\.0\.1:3103\/tavski\/"\s*$/m,
  ];
  let output = source;
  for (const pattern of patterns) {
    if (!pattern.test(output)) throw new Error("A configuração atual difere da instalação conhecida. Nada será alterado; rever o VirtualHost.");
    output = output.replace(pattern, "\n");
  }
  if (/^\s*(?:ProxyPass(?:Reverse)?|Alias)\s+"?\/tavski\//mi.test(output)) throw new Error("Existem outras regras Tavski que precisam de revisão.");
  return output.replace(/^(\s*ServerName\s+dev3\.memogadget\.com)[ \t]*$/mi, `$1\n${includeLine}`);
}

async function atomicWrite(filename, content, mode) {
  const temporary = `${filename}.tavski-${process.pid}.tmp`;
  await writeFile(temporary, content, { flag: "wx", mode });
  await rename(temporary, filename);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !["--check", "--apply"].includes(args[0]))) throw new Error("Use --check ou --apply.");
  const original = await readFile(vhostPath, "utf8");
  const updated = rewriteApache(original);
  console.log("Âmbito: apenas VirtualHost HTTPS dev3.memogadget.com, caminhos /tavski/ e /tavski/admin/.");
  if (args[0] !== "--apply") {
    console.log("Verificação concluída. Nenhum ficheiro alterado. A aplicação passará a /tavski/admin/; a raiz será estática e pública.");
    return;
  }
  if (process.platform !== "linux" || process.getuid?.() !== 0) throw new Error("A aplicação exige SSH como root no DEV3.");
  // Fail before touching Apache unless the staged landing and admin build exist.
  await stat("/home/www/dev3.memogadget.com/public_html/tavski/index.html");
  const build = await readFile("/home/www/dev3.memogadget.com/public_html/tavski/admin/.output/nitro.json", "utf8");
  if (JSON.parse(build).preset !== "node-server") throw new Error("O build deve usar node-server.");
  const snippet = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../ops/tavski-admin.apache.conf"), "utf8");
  const target = await realpath(vhostPath);
  const backup = `/root/tavski-admin-apache-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(backup, { mode: 0o700 });
  await copyFile(target, `${backup}/vhost.conf`);
  let previousInclude;
  try { previousInclude = await readFile(includePath, "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (previousInclude !== undefined) await writeFile(`${backup}/admin.conf`, previousInclude, { mode: 0o600 });
  await mkdir(dirname(includePath), { recursive: true, mode: 0o755 });
  try {
    await atomicWrite(includePath, snippet, 0o644);
    await atomicWrite(target, updated, (await stat(target)).mode & 0o777);
    const checked = spawnSync("apache2ctl", ["-t"], { stdio: "inherit" });
    if (checked.error || checked.status !== 0) throw new Error("A validação Apache falhou.");
  } catch (error) {
    await atomicWrite(target, original, (await stat(target)).mode & 0o777);
    if (previousInclude !== undefined) await atomicWrite(includePath, previousInclude, 0o644);
    throw new Error(`${error.message} O VirtualHost anterior foi restaurado. Apache não foi recarregado.`);
  }
  console.log(`Configuração validada; backup em ${backup}. Apache ainda não foi recarregado.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
