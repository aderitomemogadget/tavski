#!/usr/bin/env node
import { randomBytes, scrypt } from "node:crypto";
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function createAccessConfig(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128 || !password.trim()) {
    throw new Error("Use uma palavra-passe entre 12 e 128 caracteres.");
  }
  const salt = randomBytes(32).toString("hex");
  const hash = await deriveKey(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { version: 1, salt, hash: hash.toString("hex"), signingKey: randomBytes(32).toString("hex") };
}

export async function saveAccessConfig(filename, config) {
  const target = resolve(filename);
  if (target === projectDirectory || target.startsWith(projectDirectory + sep)) {
    throw new Error("O ficheiro privado deve ficar fora da pasta do projeto.");
  }
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const actualTarget = resolve(await realpath(dirname(target)), basename(target));
  const actualProject = await realpath(projectDirectory);
  const comparableTarget = process.platform === "win32" ? actualTarget.toLowerCase() : actualTarget;
  const comparableProject = process.platform === "win32" ? actualProject.toLowerCase() : actualProject;
  if (comparableTarget === comparableProject || comparableTarget.startsWith(comparableProject + sep)) {
    throw new Error("O ficheiro privado deve ficar fora da pasta do projeto, incluindo ligações simbólicas.");
  }
  try {
    const existing = await lstat(target);
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error("O destino deve ser um ficheiro regular, sem ligação simbólica.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(JSON.stringify(config) + "\n", "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporary, 0o600);
    await rename(temporary, target);
  } finally {
    await handle?.close();
    await unlink(temporary).catch(() => {});
  }
}

function hiddenPrompt(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Execute numa sessão SSH interativa. Não envie a palavra-passe por argumentos ou pipes.");
  return new Promise((resolvePrompt, reject) => {
    let value = "";
    const wasRaw = process.stdin.isRaw;
    emitKeypressEvents(process.stdin);
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) { value = ""; reject(error); } else { resolvePrompt(value); value = ""; }
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === "c") return finish(new Error("Operação cancelada."));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") { value = [...value].slice(0, -1).join(""); return; }
      if (!key.ctrl && !key.meta && text && !/[\u0000-\u001f\u007f]/.test(text) && value.length < 512) value += text;
    };
    process.stdin.on("keypress", onKey);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Uso: node scripts/tavski-access-password.mjs [--file /etc/tavski/access.json]\nPede e confirma a palavra-passe sem a mostrar. Não aceita palavras-passe por argumentos.");
    return;
  }
  if (args.length && !(args.length === 2 && args[0] === "--file" && args[1])) throw new Error("Argumentos inválidos. Use --help.");
  let first = await hiddenPrompt("Nova palavra-passe do popup: ");
  let second = await hiddenPrompt("Confirmar palavra-passe: ");
  if (first !== second) throw new Error("As palavras-passe não coincidem. Nada foi alterado.");
  const config = await createAccessConfig(first);
  first = second = "";
  await saveAccessConfig(args[1] ?? "/etc/tavski/access.json", config);
  console.log("Palavra-passe guardada. Reinicie apenas o Tavski: systemctl restart tavski-dev3.service\nAs autorizações anteriores do popup serão invalidadas após o reinício.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
