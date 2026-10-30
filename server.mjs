// node server.mjs : Flisk Inference console + metered OpenAI-compatible proxy. No npm dependencies.
//   sign-in:  GitHub OAuth (GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET), or FLISK_DEV_LOGIN=1 to sign in as the local `gh` user
//   backend:  OLLAMA_URL (default http://127.0.0.1:11434), one model: flisk-wolf
//   state:    data/db.json (users, hashed keys, usage) and data/secret (cookie signing key), both gitignored
import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8765);
const BASE = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const MODEL = "flisk-wolf";
const OAUTH = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const DEV = process.env.FLISK_DEV_LOGIN === "1";
// Only these GitHub logins may sign in (comma-separated, case-insensitive). Empty means anyone, so set it on a public host.
const ALLOWED = (process.env.ALLOWED_LOGINS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const MAX_BODY = 64 * 1024, MAX_TOKENS = 1024, RATE_PER_MIN = 30;

mkdirSync(join(ROOT, "data"), { recursive: true });
const DB_FILE = join(ROOT, "data", "db.json"), SECRET_FILE = join(ROOT, "data", "secret");
if (!existsSync(SECRET_FILE)) writeFileSync(SECRET_FILE, randomBytes(32).toString("hex"), { mode: 0o600 });
const SECRET = readFileSync(SECRET_FILE, "utf-8").trim();
const db = existsSync(DB_FILE) ? JSON.parse(readFileSync(DB_FILE, "utf-8")) : { users: {}, keys: [] };
const save = () => { writeFileSync(DB_FILE + ".tmp", JSON.stringify(db, null, 2)); renameSync(DB_FILE + ".tmp", DB_FILE); };
const sha = (s) => createHash("sha256").update(s).digest("hex");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (p) => createHmac("sha256", SECRET).update(p).digest("base64url");

function setSession(res, uid) {
  const p = b64({ uid, exp: Date.now() + 7 * 864e5 });
  res.setHeader("Set-Cookie", `fi_session=${p}.${sign(p)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${BASE.startsWith("https") ? "; Secure" : ""}`);
}
function sessionUser(req) {
  const m = /(?:^|;\s*)fi_session=([^;]+)/.exec(req.headers.cookie ?? "");
  if (!m) return null;
  const [p, sig] = m[1].split(".");
  if (!p || !sig) return null;
  const want = Buffer.from(sign(p)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(p, "base64url").toString());
    return s.exp > Date.now() ? db.users[s.uid] ?? null : null;
  } catch { return null; }
}
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw Object.assign(new Error("body too large"), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks).toString();
}
function upsertUser(gh) {
  const id = String(gh.id);
  db.users[id] = { id, login: gh.login, name: gh.name ?? gh.login, avatar: gh.avatar_url, created: db.users[id]?.created ?? new Date().toISOString() };
  save();
  return id;
}
const ghLocal = () => new Promise((ok, no) => execFile("gh", ["api", "user"], { timeout: 10000 }, (e, out) => (e ? no(e) : ok(JSON.parse(out)))));
const states = new Map(); // OAuth state -> expiry
const rate = new Map();   // key id -> recent request times

// Same-origin check for state-changing console calls (SameSite=Lax cookies cover the rest).
const sameOrigin = (req) => !req.headers.origin || req.headers.origin === BASE;

createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(readFileSync(join(ROOT, "site", "index.html")));
    }
    if (url.pathname === "/api/config") return json(res, 200, { oauth: OAUTH, dev: DEV, model: MODEL, base: BASE });

    // ---- sign-in
    if (url.pathname === "/auth/github") {
      if (!OAUTH) return json(res, 501, { error: "GitHub OAuth is not configured (set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)" });
      const state = randomBytes(16).toString("hex"); states.set(state, Date.now() + 600000);
      res.writeHead(302, { location: `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(BASE + "/auth/callback")}&state=${state}` });
      return res.end();
    }
    if (url.pathname === "/auth/callback") {
      const state = url.searchParams.get("state"), code = url.searchParams.get("code");
      if (!state || !(states.get(state) > Date.now()) || !code) return json(res, 400, { error: "bad state or code" });
      states.delete(state);
      const t = await (await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }) })).json();
      if (!t.access_token) return json(res, 400, { error: "GitHub did not return a token" });
      const gh = await (await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${t.access_token}`, "user-agent": "flisk-inference" } })).json();
      if (!gh.login) return json(res, 400, { error: "could not read the GitHub profile" });
      if (ALLOWED.length && !ALLOWED.includes(String(gh.login).toLowerCase())) return json(res, 403, { error: `@${gh.login} is not on the allowlist for this preview` });
      setSession(res, upsertUser(gh));
      res.writeHead(302, { location: "/?section=keys" }); return res.end();
    }
    if (url.pathname === "/auth/dev") {
      if (!DEV) return json(res, 403, { error: "dev login is off (start with FLISK_DEV_LOGIN=1)" });
      setSession(res, upsertUser(await ghLocal()));
      res.writeHead(302, { location: "/?section=keys" }); return res.end();
    }
    if (url.pathname === "/auth/logout") { res.setHeader("Set-Cookie", "fi_session=; Max-Age=0; Path=/"); res.writeHead(302, { location: "/" }); return res.end(); }

    // ---- console API (session)
    if (url.pathname.startsWith("/api/")) {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { error: "not signed in" });
      if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "cross-origin request refused" });
      const mine = db.keys.filter((k) => k.userId === user.id);
      if (url.pathname === "/api/me") return json(res, 200, user);
      if (url.pathname === "/api/keys" && req.method === "GET")
        return json(res, 200, mine.filter((k) => !k.revoked).map(({ id, name, prefix, last4, created, lastUsed }) => ({ id, name, prefix, last4, created, lastUsed })));
      if (url.pathname === "/api/keys" && req.method === "POST") {
        const { name } = JSON.parse((await readBody(req)) || "{}");
        if (mine.filter((k) => !k.revoked).length >= 10) return json(res, 400, { error: "limit of 10 active keys" });
        const key = "fi-" + randomBytes(24).toString("base64url");
        const rec = { id: randomBytes(6).toString("hex"), userId: user.id, name: String(name || "default").slice(0, 40), hash: sha(key), prefix: key.slice(0, 5), last4: key.slice(-4), created: new Date().toISOString(), lastUsed: null, requests: 0, input: 0, output: 0, revoked: false };
        db.keys.push(rec); save();
        return json(res, 201, { id: rec.id, name: rec.name, key }); // the only time the full key is shown
      }
      const del = /^\/api\/keys\/([0-9a-f]+)$/.exec(url.pathname);
      if (del && req.method === "DELETE") {
        const k = mine.find((x) => x.id === del[1]);
        if (!k) return json(res, 404, { error: "no such key" });
        k.revoked = true; save(); return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/usage") {
        const keys = mine.map((k) => ({ name: k.name, revoked: k.revoked, requests: k.requests, input: k.input, output: k.output, lastUsed: k.lastUsed }));
        const sum = (f) => keys.reduce((n, k) => n + k[f], 0);
        return json(res, 200, { totals: { requests: sum("requests"), input: sum("input"), output: sum("output") }, keys });
      }
      return json(res, 404, { error: "not found" });
    }

    // ---- /v1: API-key auth, one model, metered
    if (url.pathname.startsWith("/v1/")) {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
      const key = m && db.keys.find((k) => !k.revoked && k.hash === sha(m[1]));
      if (!key) return json(res, 401, { error: { message: "invalid or missing API key", type: "invalid_request_error" } });
      if (url.pathname === "/v1/models" && req.method === "GET") return json(res, 200, { object: "list", data: [{ id: MODEL, object: "model", owned_by: "flisk" }] });
      if (url.pathname !== "/v1/chat/completions" || req.method !== "POST") return json(res, 404, { error: { message: "not found" } });
      const now = Date.now(), recent = (rate.get(key.id) ?? []).filter((t) => now - t < 60000);
      if (recent.length >= RATE_PER_MIN) return json(res, 429, { error: { message: `rate limit: ${RATE_PER_MIN} requests per minute` } });
      rate.set(key.id, [...recent, now]);
      const body = JSON.parse((await readBody(req)) || "{}");
      if (body.model !== MODEL) return json(res, 400, { error: { message: `model must be "${MODEL}"` } });
      if (body.stream) return json(res, 400, { error: { message: "streaming is not supported yet" } });
      body.max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS);
      const up = await fetch(`${OLLAMA}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
      const out = await up.json();
      if (up.ok && out.usage) { key.requests++; key.input += out.usage.prompt_tokens ?? 0; key.output += out.usage.completion_tokens ?? 0; key.lastUsed = new Date().toISOString(); save(); }
      return json(res, up.status, out);
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, e.code === 413 ? 413 : 500, { error: e.code === 413 ? "body too large" : "server error" });
    if (e.code !== 413) console.error(e);
  }
}).listen(PORT, HOST, () => console.log(`Flisk Inference on ${BASE}  (oauth: ${OAUTH}, dev login: ${DEV}, allowlist: ${ALLOWED.length ? ALLOWED.join(",") : "none"}, backend: ${OLLAMA})`));
