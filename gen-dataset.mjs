// node gen-dataset.mjs : verified synthetic training data and a disjoint held-out eval.
// Ground truth comes from structured specs, never from a model, and every target must pass the Flisk validator.
// Train and eval use different phrasing styles AND different name/stack/value pools, so the eval cannot be memorised.
import { writeFileSync } from "node:fs";
import { validateService } from "./lib/validate.mjs";
import { SYSTEM } from "./lib/templates.mjs";

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const POOLS = {
  A: {
    stacks: ["shop", "blog", "pay", "kitchen", "hr", "crm", "chat", "forum", "wiki", "inventory", "booking", "support", "news", "gallery", "learning", "billing", "search", "sensors", "orders", "social"],
    stems: ["orders", "billing", "catalog", "search", "mailer", "reports", "auth", "profile", "feed", "cart", "ticket", "invoice", "export", "import", "notify", "cache", "queue", "media", "stats", "sync", "audit", "chatbot", "planner", "router"],
    images: ["redis:7", "postgres:16", "nginx:1.27", "rabbitmq:3", "minio/minio", "mailhog/mailhog", "grafana/grafana:11", "memcached:1.6", "mongo:7", "clickhouse/clickhouse-server:24", "ollama/ollama", "traefik:v3", "adminer", "meilisearch/meilisearch:v1"],
    cmds: ["node server.js", "bun run dev", "python app.py", "uvicorn main:app --port $PORT", "go run .", "npm start", "deno run -A main.ts", "ruby app.rb"],
    health: ["/health", "/healthz", "/ready", "/ping", "/status", "/api/health", "/up"],
    bases: ["/admin", "/app", "/portal", "/docs", "/shop", "/dash"],
  },
  B: { // never used for training
    stacks: ["lab", "garage", "studio", "clinic", "harbor", "farm", "atlas", "orbit", "nimbus", "quartz"],
    stems: ["rooster", "tundra", "lantern", "meadow", "falcon", "mosaic", "pebble", "saffron", "tulip", "walnut", "zephyr", "ember"],
    images: ["couchdb:3", "valkey/valkey:8", "caddy:2", "nats:2", "keycloak/keycloak:25", "etcd:3.5", "influxdb:2", "vault:1.17"],
    cmds: ["php artisan serve", "dotnet run", "cargo run", "java -jar app.jar", "elixir app.exs"],
    health: ["/alive", "/livez", "/hc", "/state"],
    bases: ["/studio", "/lab", "/tools", "/hub"],
  },
};
const TYPE_WORD = { backend: ["HTTP API backend", "backend API", "API server", "REST service"], frontend: ["web frontend", "frontend", "web app UI", "single-page frontend"], worker: ["background worker", "worker", "job processor", "queue worker"], migrator: ["database migration job", "migrator", "schema migration runner"], mcp: ["MCP server", "Model Context Protocol server", "tool server for agents"], agent: ["AI agent", "long-running agent", "agent service"], "bring-your-own": ["existing container", "container", "third-party service", "prebuilt service"] };
const STYLES = {
  A: [
    (c) => `Write a Flisk service.json for ${c.what}${c.tail}. Reply with the JSON only.`,
    (c) => `Create the service.json for ${c.what}${c.tail}.`,
    (c) => `I need a Flisk service definition: ${c.what}${c.tail}. Output only JSON.`,
    (c) => `Give me service.json for ${c.what}${c.tail}. JSON only please.`,
    (c) => `Flisk config please: ${c.what}${c.tail}.`,
  ],
  B: [
    (c) => `Our team is adding ${c.what}${c.tail}. What should its Flisk service.json contain? Just the JSON.`,
    (c) => `service.json needed -- ${c.what}${c.tail}. No commentary.`,
    (c) => `Set up ${c.what}${c.tail} in Flisk and show me the manifest as JSON.`,
  ],
};

function makeSpec(r, pool, kindHint) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const stem = pick(pool.stems), stack = pick(pool.stacks);
  const kinds = ["backend", "backend", "frontend", "worker", "migrator", "mcp", "agent", "bring-your-own", "bring-your-own", "native"];
  const kind = kindHint ?? pick(kinds);
  const s = { schemaVersion: 1 };
  const port = (lo, hi) => lo + Math.floor(r() * (hi - lo));
  if (kind === "native") {
    s.appName = `${stem}-${pick(["api", "svc", "app"])}`; s.appType = pick(["backend", "frontend", "worker"]);
    s.command = pick(pool.cmds); if (r() < 0.8) s.port = port(3000, 9000);
    if (r() < 0.4) s.env = { [pick(["LOG_LEVEL", "MODE", "REGION", "FEATURE_X"])]: pick(["debug", "prod", "eu", "on", "1"]) };
    return s;
  }
  s.appName = `${stem}-${pick(["api", "web", "svc", "job", "app"])}`; s.appType = kind; s.stack = stack;
  if (kind === "bring-your-own") {
    s.appName = `${stem}-${pick(["cache", "db", "queue", "store", "box"])}`;
    s.image = pick(pool.images); s.port = port(1024, 20000);
    if (r() < 0.5) s.healthCheckPath = pick(pool.health);
    if (r() < 0.3) s.restart = pick(["no", "on-failure", "always"]);
    if (r() < 0.25) s.exposeViaProxy = false;
    return s;
  }
  if (["backend", "mcp", "frontend"].includes(kind) && r() < 0.7) s.port = port(3000, 6000);
  if (["backend", "frontend"].includes(kind) && r() < 0.35) s.healthCheckPath = pick(pool.health);
  if (kind === "frontend" && r() < 0.3) s.basePath = pick(pool.bases);
  if (kind === "backend" && r() < 0.25) s.replicas = 2 + Math.floor(r() * 3);
  if (kind === "agent" && r() < 0.6) s.agent = { durability: "files" };
  if (r() < 0.2) s.enabled = false;
  if (r() < 0.35) { const n = 1 + Math.floor(r() * 2); s.dependsOn = Array.from({ length: n }, () => `${pick(pool.stems)}-${pick(["db", "api", "queue"])}`).filter((v, i, a) => a.indexOf(v) === i); }
  return s;
}
function clauses(s, r, set) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const word = s.command ? pick(["backend API", "service", "app"]) : pick(TYPE_WORD[s.appType]);
  const what = `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word} called "${s.appName}"`;
  const t = [];
  if (s.stack) t.push(pick([`in the "${s.stack}" stack`, `in the ${s.stack} stack`, `for the "${s.stack}" stack`]));
  if (s.port) t.push(pick([`on port ${s.port}`, `listening on ${s.port}`, `using port ${s.port}`]));
  if (s.image) t.push(pick([`using the image ${s.image}`, `from the Docker image ${s.image}`, `running ${s.image}`]));
  if (s.command) t.push(pick([`run locally with the command "${s.command}"`, `started by \`${s.command}\``]) + ", no image and no Dockerfile");
  if (s.healthCheckPath) t.push(pick([`with health check ${s.healthCheckPath}`, `health path ${s.healthCheckPath}`]));
  else if (s.image && !s.healthCheckPath) t.push(pick(["with no HTTP health path", "it does not speak HTTP, so no health path"]));
  if (s.basePath) t.push(`served under the base path ${s.basePath}`);
  if (s.replicas) t.push(`running ${s.replicas} replicas`);
  if (s.agent) t.push("keeping its session checkpoints in files");
  if (s.restart) t.push({ no: "that must not restart after it exits", "on-failure": "that restarts only on failure", always: "that always restarts" }[s.restart]);
  if (s.exposeViaProxy === false) t.push("that must not get a Traefik route");
  if (s.enabled === false) t.push("switched off for now");
  if (s.env) t.push(`with the environment variable ${Object.keys(s.env)[0]} set to ${Object.values(s.env)[0]}`);
  if (s.dependsOn) t.push(`that depends on ${s.dependsOn.map((d) => `"${d}"`).join(" and ")}`);
  const tail = t.length ? ", " + t.join(", ") : "";
  return { what, tail };
}
const order = ["schemaVersion", "appName", "appType", "stack", "port", "image", "command", "healthCheckPath", "basePath", "replicas", "agent", "restart", "exposeViaProxy", "enabled", "env", "dependsOn"];
const sorted = (o) => Object.fromEntries(Object.keys(o).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((k) => [k, o[k]]));
const nl = (s, r, set) => { const st = STYLES[set]; return st[Math.floor(r() * st.length)](clauses(s, r, set)); };
const expectOf = (s) => { const { schemaVersion, ...rest } = s; return rest; };

function single(r, set) { for (;;) { const s = sorted(makeSpec(r, POOLS[set])); if (!validateService(s).errors.length) return s; } }
function stackOf(r, set) {
  const pool = POOLS[set], pick = (a) => a[Math.floor(r() * a.length)], stack = pick(pool.stacks);
  const n = 2 + Math.floor(r() * 3), used = new Set(), svcs = [];
  const kinds = ["bring-your-own", "migrator", "backend", "worker", "frontend", "mcp", "agent"];
  for (let i = 0; i < n; i++) {
    let s; do { s = single(r, set); } while (used.has(s.appName));
    used.add(s.appName); s.stack = stack; delete s.dependsOn; delete s.enabled; delete s.command;
    if (!s.appType) s.appType = "backend";
    if (i > 0) s.dependsOn = [svcs[Math.floor(r() * i)].appName];
    svcs.push(sorted(s));
  }
  return svcs.filter((s) => !validateService(s).errors.length);
}
const BREAKS = [
  (s) => { const { stack, ...x } = s; return stack ? x : null; },
  (s) => ({ ...s, schemaVersion: 2 }),
  (s) => (s.command ? { ...s, image: "node:22" } : null),
  (s) => (s.env ? { ...s, env: { [Object.keys(s.env)[0]]: 3 } } : null),
  (s) => ({ ...s, appType: 7 }),
];
function repair(r, set) { for (;;) { const s = single(r, set); const b = BREAKS[Math.floor(r() * BREAKS.length)](s); if (b && validateService(b).errors.length) return { good: s, bad: b }; } }
const repairPrompt = (bad) => `This Flisk service.json is rejected:\n${JSON.stringify(bad, null, 2)}\n\nThe validator says:\n${validateService(bad).errors.join("\n")}\n\nFix it with the smallest change that makes it valid, keeping every other field. Reply with the corrected JSON object only.`;
const stackPrompt = (svcs, r, set) => {
  const parts = svcs.map((s) => { const c = clauses({ ...s, stack: undefined, dependsOn: s.dependsOn }, r, set); return `${c.what}${c.tail}`; });
  return `Write the Flisk service.json files for a "${svcs[0].stack}" stack: ${parts.join("; ")}. Reply with a JSON array of the ${svcs.length} objects and nothing else.`;
};

const msg = (user, assistant) => JSON.stringify({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }, { role: "assistant", content: assistant }] });
const N = { single: 1500, stack: 400, repair: 400, valid: 120 };
const rt = rng(1234), train = [], valid = [], seen = new Set();
const add = (line, key, into) => { if (!seen.has(key)) { seen.add(key); into.push(line); } };
for (let i = 0; i < N.single * 1.1; i++) { const s = single(rt, "A"); const u = nl(s, rt, "A"); add(msg(u, JSON.stringify(s, null, 2)), u, i % 12 === 0 ? valid : train); }
for (let i = 0; i < N.stack; i++) { const sv = stackOf(rt, "A"); if (sv.length < 2) continue; const u = stackPrompt(sv, rt, "A"); add(msg(u, JSON.stringify(sv, null, 2)), u, i % 12 === 0 ? valid : train); }
for (let i = 0; i < N.repair; i++) { const { good, bad } = repair(rt, "A"); const u = repairPrompt(bad); add(msg(u, JSON.stringify(good, null, 2)), u, i % 12 === 0 ? valid : train); }
writeFileSync("data/train.jsonl", train.join("\n") + "\n"); writeFileSync("data/valid.jsonl", valid.join("\n") + "\n");

// Held-out eval: pool B, style set B, a different seed. Nothing here is reachable from the training generator.
const re = rng(98765), tasks = [];
for (let i = 0; i < 40; i++) { const s = single(re, "B"); tasks.push({ id: `b-single-${i}`, prompt: nl(s, re, "B") + " Reply with the JSON only.", expect: expectOf(s), absent: s.image && !s.healthCheckPath ? ["healthCheckPath"] : [] }); }
for (let i = 0; i < 10; i++) { const sv = stackOf(re, "B"); if (sv.length < 2) continue; tasks.push({ id: `b-stack-${i}`, kind: "stack", prompt: stackPrompt(sv, re, "B"), services: sv.map(expectOf) }); }
for (let i = 0; i < 12; i++) { const { good, bad } = repair(re, "B"); tasks.push({ id: `b-repair-${i}`, broken: bad, keep: expectOf(good), mustHave: ["stack", "appType"].filter((k) => !(k in bad) || typeof bad[k] !== "string") }); }
writeFileSync("evals/tasks-b.json", JSON.stringify(tasks, null, 2));
console.log(`train ${train.length}, valid ${valid.length}, held-out eval tasks ${tasks.length}`);
const trainText = train.join("\n");
const leaks = tasks.filter((t) => t.prompt && trainText.includes(t.prompt)).length;
console.log(`held-out prompts found verbatim in training data: ${leaks}`);
const pb = POOLS.B.stems.filter((x) => trainText.includes(`"${x}-`)).length; console.log(`held-out name stems appearing in training data: ${pb}`);
