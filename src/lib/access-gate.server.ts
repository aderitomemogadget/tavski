import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { accessPopup } from "./access-popup.server";

const deriveKey = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error); else resolve(key);
  });
});
const cookieName = "__Secure-tavski_access";
const sessionSeconds = 8 * 60 * 60;
const attemptWindow = 10 * 60 * 1000;

type AccessConfig = { version: 1; salt: string; hash: string; signingKey: string };
type GateOptions = {
  enabled: boolean;
  origin: string;
  basePath: string;
  loadConfig: () => Promise<unknown>;
  trustProxy?: boolean;
  now?: () => number;
};

function validateConfig(value: unknown): AccessConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid access configuration");
  const config = value as Record<string, unknown>;
  if (config.version !== 1 || typeof config.salt !== "string" || !/^[a-f0-9]{64}$/.test(config.salt)
    || typeof config.hash !== "string" || !/^[a-f0-9]{128}$/.test(config.hash)
    || typeof config.signingKey !== "string" || !/^[a-f0-9]{64}$/.test(config.signingKey)) {
    throw new Error("Invalid access configuration");
  }
  return config as AccessConfig;
}

function cookie(value: string, basePath: string, clear = false) {
  return `${cookieName}=${value}; Path=${basePath}; HttpOnly; Secure; SameSite=Strict${clear ? "; Max-Age=0" : ""}`;
}

function signature(payload: string, config: AccessConfig) {
  return createHmac("sha256", Buffer.from(config.signingKey, "hex")).update(payload).digest();
}

function hasAccess(request: Request, config: AccessConfig, now: number) {
  const raw = request.headers.get("cookie") ?? "";
  if (raw.length > 16384) return false;
  const values = raw.split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName}=`));
  if (values.length !== 1) return false;
  const token = values[0].slice(cookieName.length + 1);
  if (token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [payload, signed] = token.split(".");
  const expected = signature(payload, config);
  const supplied = Buffer.from(signed, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    return claims.v === 1 && Number.isInteger(claims.iat) && Number.isInteger(claims.exp)
      && claims.iat <= seconds + 60 && claims.exp > seconds && claims.exp > claims.iat
      && claims.exp <= claims.iat + sessionSeconds;
  } catch { return false; }
}

function createToken(config: AccessConfig, now: number) {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, iat, exp: iat + sessionSeconds, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${signature(payload, config).toString("base64url")}`;
}

function json(status: number, data: object, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

async function readPassword(request: Request): Promise<string | null> {
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") return null;
  if (Number(request.headers.get("content-length")) > 4096 || !request.body) return null;
  const reader = request.body.getReader();
  const timer = setTimeout(() => { void reader.cancel().catch(() => {}); }, 5000);
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof parsed.password === "string" && Buffer.byteLength(parsed.password) <= 1024 ? parsed.password : null;
  } catch { return null; }
  finally { clearTimeout(timer); reader.releaseLock(); }
}

export function createAccessGate(options: GateOptions) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(options.basePath)) throw new Error("Invalid access base path");
  if (options.enabled) {
    const origin = new URL(options.origin);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if (origin.origin !== options.origin || (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))) throw new Error("Invalid public origin");
  }
  const now = options.now ?? Date.now;
  const endpoint = `${options.basePath}_access`;
  const attempts = new Map<string, { count: number; resetAt: number }>();
  let globalWindow = { count: 0, resetAt: 0 };
  let inFlight = 0;
  let configPromise: Promise<AccessConfig> | undefined;
  const load = () => (configPromise ??= options.loadConfig().then(validateConfig));

  return async function handle(request: Request): Promise<Response | null> {
    const isEndpoint = new URL(request.url).pathname === endpoint;
    if (!options.enabled) return isEndpoint ? json(200, { required: false, authenticated: true }) : null;
    let config: AccessConfig;
    try { config = await load(); }
    catch { return isEndpoint ? json(503, { error: "unavailable" }) : accessPopup(request, options.basePath, true); }

    const authenticated = hasAccess(request, config, now());
    if (!isEndpoint) {
      if (authenticated) return null;
      if (request.method !== "GET" && request.method !== "HEAD") return json(401, { error: "access_required" });
      if ((request.headers.get("accept") ?? "").includes("text/html")) {
        const response = accessPopup(request, options.basePath);
        response.headers.set("Set-Cookie", cookie("", options.basePath, true));
        return response;
      }
      return json(401, { error: "access_required" });
    }
    if (request.method === "GET") return json(authenticated ? 200 : 401, { required: true, authenticated });
    if (request.method !== "POST" && request.method !== "DELETE") return json(405, { error: "method_not_allowed" }, { Allow: "GET, POST, DELETE" });
    if (request.headers.get("origin") !== options.origin || request.headers.get("sec-fetch-site") === "cross-site") return json(403, { error: "origin_rejected" });
    if (request.method === "DELETE") return json(200, { authenticated: false }, { "Set-Cookie": cookie("", options.basePath, true) });

    const timestamp = now();
    // Apache appends its observed peer at the END of X-Forwarded-For. Only trust
    // this when the dedicated Node port is bound to loopback behind that proxy.
    const forwarded = options.trustProxy ? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() : undefined;
    const client = forwarded && isIP(forwarded) ? forwarded : "unknown";
    for (const [key, record] of attempts) if (record.resetAt <= timestamp) attempts.delete(key);
    let record = attempts.get(client);
    if (!record) {
      if (attempts.size >= 2000) return json(429, { error: "rate_limited" }, { "Retry-After": "60" });
      record = { count: 0, resetAt: timestamp + attemptWindow };
      attempts.set(client, record);
    }
    if (globalWindow.resetAt <= timestamp) globalWindow = { count: 0, resetAt: timestamp + 60000 };
    if (record.count >= 5 || globalWindow.count >= 60 || inFlight >= 4) {
      const retry = record.count >= 5 ? Math.ceil((record.resetAt - timestamp) / 1000) : 60;
      return json(429, { error: "rate_limited" }, { "Retry-After": String(retry) });
    }
    record.count++;
    globalWindow.count++;
    inFlight++;
    try {
      const password = await readPassword(request);
      if (password === null) return json(400, { error: "invalid_request" });
      const derived = await deriveKey(password, config.salt);
      if (!timingSafeEqual(derived, Buffer.from(config.hash, "hex"))) return json(401, { error: "incorrect_password" });
      attempts.delete(client);
      return json(200, { authenticated: true }, { "Set-Cookie": cookie(createToken(config, now()), options.basePath) });
    } finally { inFlight--; }
  };
}

let activeGate: ReturnType<typeof createAccessGate> | undefined;

export async function checkAccessGate(request: Request, buildBasePath: string): Promise<Response | null> {
  try {
    if (!activeGate) {
      const flag = process.env.TAVSKI_ACCESS_ENABLED;
      if (flag !== undefined && flag !== "0" && flag !== "1") throw new Error("Invalid access flag");
      activeGate = createAccessGate({
        enabled: flag === "1", origin: process.env.TAVSKI_PUBLIC_ORIGIN ?? "",
        basePath: buildBasePath, trustProxy: process.env.TAVSKI_ACCESS_TRUST_PROXY === "1",
        loadConfig: async () => {
          const directory = process.env.CREDENTIALS_DIRECTORY;
          if (!directory) throw new Error("Missing private credential directory");
          const content = await readFile(join(directory, "tavski-access"), "utf8");
          if (content.length > 4096) throw new Error("Invalid credential size");
          return JSON.parse(content);
        },
      });
    }
    return await activeGate(request);
  } catch {
    // Never log request bodies, password hashes, signing keys or config contents.
    return new URL(request.url).pathname === `${buildBasePath}_access`
      ? json(503, { error: "unavailable" }) : accessPopup(request, buildBasePath, true);
  }
}

export function privateAccessResponse(response: Response): Response {
  if (process.env.TAVSKI_ACCESS_ENABLED !== "1") return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  const vary = headers.get("Vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "cookie")) headers.set("Vary", vary ? `${vary}, Cookie` : "Cookie");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
