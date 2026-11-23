// Run: node --test tests/access-gate.test.cjs
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const { createAccessGate, privateAccessResponse } = require("../src/lib/access-gate.server.ts");
const origin = "https://dev3.memogadget.com";
const password = "Only-a-test-password-123";
let config, replacement, cli;
before(async () => {
  cli = await import(pathToFileURL(path.resolve(__dirname, "../scripts/tavski-access-password.mjs")).href);
  config = await cli.createAccessConfig(password);
  replacement = await cli.createAccessConfig("Replacement-test-password-456");
});
const makeGate = (overrides = {}) => createAccessGate({ enabled: true, origin, basePath: "/tavski/", trustProxy: true, loadConfig: async () => config, ...overrides });
const request = (pathname = "clients", options = {}) => new Request(`http://127.0.0.1:3103/tavski/${pathname}`, { ...options, headers: { Accept: "text/html", ...options.headers } });
const login = (pw = password, headers = {}) => request("_access", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.7", ...headers }, body: JSON.stringify({ password: pw }) });
const cookieFrom = (response) => response.headers.get("set-cookie").split(";")[0];

test("locked pages and RPCs cannot reach the application, including encoded paths", async () => {
  const gate = makeGate();
  for (const pathname of ["", "auth", "clients", "products/id", "%5faccess"]) {
    const response = await gate(request(pathname));
    assert.equal(response.status, 401);
    const html = await response.text();
    assert.match(html, /role="dialog"/);
    assert.ok(!html.includes(config.hash) && !html.includes(config.signingKey) && !html.includes(config.salt));
    assert.ok(!html.includes("supabase.co"));
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  const rpc = await gate(request("_server/test", { method: "POST", body: "{}" }));
  assert.equal(rpc.status, 401);
});

test("password verification issues a signed, scoped session cookie and permits the login page", async () => {
  const gate = makeGate();
  assert.equal((await gate(login("wrong-password"))).status, 401);
  const response = await gate(login());
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /^__Secure-tavski_access=/);
  assert.match(cookie, /Path=\/tavski\/; HttpOnly; Secure; SameSite=Strict/);
  assert.ok(!cookie.includes("Domain=") && !cookie.includes("Max-Age="));
  assert.equal(await gate(request("auth", { headers: { Cookie: cookieFrom(response) } })), null);
  const state = await gate(request("_access", { headers: { Cookie: cookieFrom(response) } }));
  assert.deepEqual(await state.json(), { required: true, authenticated: true });
});

test("tampering, expiry, duplicate cookies and a rotated password invalidate access", async () => {
  let clock = Date.now();
  const gate = makeGate({ now: () => clock });
  const issued = await gate(login());
  const original = cookieFrom(issued);
  const [name, token] = original.split("=");
  const pieces = token.split(".");
  pieces[0] = Buffer.from(JSON.stringify({ v: 1, iat: 0, exp: 9999999999 })).toString("base64url");
  assert.equal((await gate(request("auth", { headers: { Cookie: `${name}=${pieces.join(".")}` } }))).status, 401);
  assert.equal((await gate(request("auth", { headers: { Cookie: `${original}; ${original}` } }))).status, 401);
  assert.equal((await makeGate({ loadConfig: async () => replacement })(request("auth", { headers: { Cookie: original } }))).status, 401);
  clock += 8 * 60 * 60 * 1000 + 1000;
  assert.equal((await gate(request("auth", { headers: { Cookie: original } }))).status, 401);
});

test("login and logout reject cross-origin requests and unsupported methods", async () => {
  const gate = makeGate();
  assert.equal((await gate(login(password, { Origin: "https://other.example" }))).status, 403);
  assert.equal((await gate(login(password, { Origin: "null" }))).status, 403);
  assert.equal((await gate(login(password, { "Sec-Fetch-Site": "cross-site" }))).status, 403);
  assert.equal((await gate(request("_access", { method: "DELETE" }))).status, 403);
  const logout = await gate(request("_access", { method: "DELETE", headers: { Origin: origin } }));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await gate(request("_access", { method: "PUT" }))).status, 405);
});

test("five attempts are capped per observed proxy peer; spoofed prefixes do not bypass the cap", async () => {
  let clock = Date.now();
  const gate = makeGate({ now: () => clock });
  for (let index = 0; index < 5; index++) {
    assert.equal((await gate(login("wrong", { "X-Forwarded-For": `192.0.2.${index}, 198.51.100.7` }))).status, 401);
  }
  const blocked = await gate(login());
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal((await gate(login(password, { "X-Forwarded-For": "198.51.100.8" }))).status, 200);
  clock += 10 * 60 * 1000 + 1000;
  assert.equal((await gate(login())).status, 200);
});

test("concurrent scrypt work is bounded", async () => {
  const gate = makeGate();
  const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => gate(login(password, { "X-Forwarded-For": `198.51.100.${index + 1}` }))));
  assert.ok(responses.filter((response) => response.status === 429).length >= 4);
  assert.ok(responses.some((response) => response.status === 200));
});

test("malformed bodies and oversized streaming bodies are rejected", async () => {
  const gate = makeGate();
  const options = { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" } };
  assert.equal((await gate(request("_access", { ...options, body: "not JSON" }))).status, 400);
  assert.equal((await gate(request("_access", { ...options, body: JSON.stringify({ password: "x".repeat(5000) }) }))).status, 400);
  assert.equal((await gate(login(password, { "Content-Type": "text/plain" }))).status, 400);
});

test("missing or invalid private configuration fails closed; disabled mode is explicit", async () => {
  const unavailable = makeGate({ loadConfig: async () => { throw new Error("private details"); } });
  const response = await unavailable(request());
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private details"));
  assert.equal((await makeGate({ loadConfig: async () => ({}) })(request("_access"))).status, 503);
  const disabled = makeGate({ enabled: false });
  assert.equal(await disabled(request()), null);
  assert.deepEqual(await (await disabled(request("_access"))).json(), { required: false, authenticated: true });
  assert.throws(() => makeGate({ basePath: "/unsafe;cookie/" }));
  assert.throws(() => makeGate({ origin: "https://other.example/path" }));
});

test("authenticated HTML is not cacheable when protection is enabled", () => {
  const previous = process.env.TAVSKI_ACCESS_ENABLED;
  try {
    process.env.TAVSKI_ACCESS_ENABLED = "1";
    const response = privateAccessResponse(new Response("private", { headers: { Vary: "Accept" } }));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("vary"), /Accept, Cookie/);
  } finally {
    if (previous === undefined) delete process.env.TAVSKI_ACCESS_ENABLED; else process.env.TAVSKI_ACCESS_ENABLED = previous;
  }
});

test("SSH password management writes only a hash and rotates the signing key outside the project", async () => {
  assert.ok(!JSON.stringify(config).includes(password));
  const repeated = await cli.createAccessConfig(password);
  assert.notEqual(config.salt, repeated.salt);
  assert.notEqual(config.signingKey, repeated.signingKey);
  await assert.rejects(cli.createAccessConfig("short"));
  await assert.rejects(cli.saveAccessConfig(path.resolve(__dirname, "../access-private-test.json"), config));
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "tavski-access-test-"));
  try {
    const filename = path.join(directory, "access.json");
    await cli.saveAccessConfig(filename, config);
    assert.deepEqual(JSON.parse(await fsp.readFile(filename, "utf8")), config);
    await cli.saveAccessConfig(filename, repeated);
    assert.deepEqual(JSON.parse(await fsp.readFile(filename, "utf8")), repeated);
    if (process.platform !== "win32") assert.equal((await fsp.stat(filename)).mode & 0o777, 0o600);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("tavski-access-test-"));
    await fsp.rm(directory, { recursive: true, force: true });
  }
});
