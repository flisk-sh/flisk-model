// node gen-diverse.mjs : training data with many phrasing styles, written to data-v3/.
// Ground truth still comes from structured specs and must pass the Flisk validator. Names that appear in either
// natural-wording test are banned, so those tests stay clean held-out sets.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { validateService } from "./lib/validate.mjs";
import { SYSTEM } from "./lib/templates.mjs";

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(777);
const pick = (a) => a[Math.floor(r() * a.length)];
const chance = (p) => r() < p;
const int = (lo, hi) => lo + Math.floor(r() * (hi - lo));

// ---- names that must never appear in training
const banned = new Set();
for (const f of ["evals/tasks-wild.json", "evals/tasks-wild2.json"]) {
  for (const t of JSON.parse(readFileSync(f, "utf-8"))) {
    for (const s of t.services ?? [t.expect ?? t.keep ?? {}]) { if (s.appName) banned.add(s.appName); for (const d of s.dependsOn ?? []) banned.add(d); }
  }
}
const wildPrompts = new Set([...JSON.parse(readFileSync("evals/tasks-wild.json", "utf-8")), ...JSON.parse(readFileSync("evals/tasks-wild2.json", "utf-8"))].map((t) => t.prompt));

// ---- pools (wider than the first generator)
const STEMS = "alpha beacon cobalt delta ember fjord glacier harbor iris jasper kestrel lotus marble nectar onyx pearl quill raven sable topaz umber velvet willow xenon yarrow zinc acorn birch cedar dune elm fern grove heron ivy juniper kelp larch maple nettle olive pine quince reed spruce thistle urchin vine wren yucca amber brook coral dawn echo flint gale hazel indigo jade karma lunar mist north opal prism quartz ridge sierra tide ultra vista wisp".split(" ");
const SUF = ["api", "web", "svc", "job", "app", "db", "cache", "queue", "worker", "ui", "store", "bot", "sync", "runner", "tools", "gateway", "ingest", "export"];
const STACKS = "garden bakery library museum school arcade studio airline bank cinema clinic farm gym kitchen lab market news office pharmacy radio shipping stadium theatre usage vault weather yard zoo".split(" ");
const IMAGES = ["redis:7", "postgres:16", "nginx:1.27", "rabbitmq:3", "minio/minio", "mailhog/mailhog", "memcached:1.6", "mongo:7", "mariadb:11", "etcd:3.5", "nats:2", "couchdb:3", "valkey/valkey:8", "caddy:2", "influxdb:2", "vault:1.17", "traefik:v3", "adminer", "ollama/ollama", "meilisearch/meilisearch:v1", "keycloak/keycloak:25", "grafana/grafana:11", "clickhouse/clickhouse-server:24", "elasticsearch:8.13", "mysql:8"];
const CMDS = ["node server.js", "bun run dev", "python app.py", "uvicorn main:app --port $PORT", "go run .", "npm start", "deno run -A main.ts", "ruby app.rb", "php artisan serve", "python worker.py", "node poller.js", "cargo run", "java -jar app.jar"];
const HEALTH = ["/health", "/healthz", "/ready", "/ping", "/status", "/api/health", "/up", "/alive", "/livez", "/hc", "/state", "/stats"];
const BASES = ["/admin", "/app", "/portal", "/docs", "/shop", "/dash", "/store", "/tools", "/studio", "/hub"];
const ENVK = ["LOG_LEVEL", "MODE", "REGION", "FEATURE_X", "TZ", "DEBUG"], ENVV = ["debug", "prod", "eu", "on", "1", "utc"];
const okName = (n) => !banned.has(n);
const name = (suffixes) => { for (;;) { const n = `${pick(STEMS)}-${pick(suffixes)}`; if (okName(n)) return n; } };

// ---- specs
function spec(kindHint) {
  const kind = kindHint ?? pick(["backend", "backend", "frontend", "worker", "migrator", "mcp", "agent", "byo", "byo", "native"]);
  const s = { schemaVersion: 1 };
  if (kind === "native") {
    s.appName = name(["api", "app", "worker", "web"]); s.appType = pick(["backend", "frontend", "worker"]); s.command = pick(CMDS);
    if (chance(0.7)) s.port = int(3000, 9000);
    if (chance(0.3)) s.env = { [pick(ENVK)]: pick(ENVV) };
    return s;
  }
  s.stack = pick(STACKS);
  if (kind === "byo") {
    s.appName = name(["cache", "db", "queue", "store", "box", "broker", "index"]); s.appType = "bring-your-own"; s.image = pick(IMAGES); s.port = int(1024, 20000);
    if (chance(0.5)) s.healthCheckPath = pick(HEALTH);
    if (chance(0.3)) s.restart = pick(["no", "on-failure", "always"]);
    if (chance(0.25)) s.exposeViaProxy = false;
    return s;
  }
  s.appName = name(kind === "worker" ? ["worker", "job", "runner", "ingest", "sync"] : kind === "migrator" ? ["migrate", "migrations", "job"] : kind === "frontend" ? ["web", "ui", "app"] : kind === "agent" ? ["agent", "bot", "concierge"] : ["api", "svc", "app", "gateway", "tools"]);
  s.appType = kind;
  if (["backend", "mcp", "frontend"].includes(kind) && chance(0.65)) s.port = int(3000, 6000);
  if (["backend", "frontend"].includes(kind) && chance(0.3)) s.healthCheckPath = pick(HEALTH);
  if (kind === "frontend" && chance(0.3)) s.basePath = pick(BASES);
  if (kind === "backend" && chance(0.25)) s.replicas = int(2, 6);
  if (kind === "agent" && chance(0.55)) s.agent = { durability: "files" };
  if (chance(0.15)) s.enabled = false;
  if (chance(0.3)) s.dependsOn = Array.from({ length: int(1, 3) }, () => name(["db", "api", "queue", "cache"])).filter((v, i, a) => a.indexOf(v) === i);
  return s;
}
const order = ["schemaVersion", "appName", "appType", "stack", "port", "image", "command", "healthCheckPath", "basePath", "replicas", "agent", "restart", "exposeViaProxy", "enabled", "env", "dependsOn"];
const sorted = (o) => Object.fromEntries(Object.keys(o).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((k) => [k, o[k]]));
const good = (kind) => { for (;;) { const s = sorted(spec(kind)); if (!validateService(s).errors.length && okName(s.appName)) return s; } };

// ---- wording
const TYPE = {
  backend: ["backend", "backend API", "API", "api", "REST service", "API server", "HTTP service", "web API", "backend service", "service"],
  frontend: ["frontend", "front end", "web app", "UI", "web UI", "site", "SPA", "web frontend"],
  worker: ["worker", "background worker", "job runner", "queue worker", "consumer", "job processor"],
  migrator: ["migrator", "migration job", "db migration", "migrations", "schema migration job", "database migrations"],
  mcp: ["MCP server", "mcp", "MCP", "tool server", "Model Context Protocol server"],
  agent: ["agent", "AI agent", "agent service", "long-running agent", "assistant agent"],
  "bring-your-own": ["container", "docker container", "existing container", "prebuilt service", "service", "third-party service", "docker image"],
};
const typo = (w) => (chance(0.08) && w.length > 4 ? (() => { const i = int(1, w.length - 2); return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2); })() : w);
const q = () => pick(["", "", '"', "'", "`"]);
function typeWord(s) {
  let words = TYPE[s.appType];
  if (s.command) words = words.filter((w) => w !== "service");               // a command service must name its type
  if (s.appType === "bring-your-own" && !s.image) words = words.filter((w) => w !== "service");
  return typo(pick(words));
}
const nameP = (n, bare) => { const Q = q(); return pick([`called ${Q}${n}${Q}`, `named ${Q}${n}${Q}`, `${Q}${n}${Q}`, `name: ${n}`, `call it ${n}`, `(${n})`]); };
const art = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
function facts(s, withStack = true) {
  const f = [];
  const S = s.stack;
  if (withStack && S) f.push(pick([`in the ${S} stack`, `in stack ${S}`, `for the ${S} stack`, `stack: ${S}`, `(stack ${S})`, `stack ${S}`, `on the ${S} stack`, `in the "${S}" stack`]));
  if (s.port) f.push(pick([`port ${s.port}`, `on port ${s.port}`, `on ${s.port}`, `listening on ${s.port}`, `using port ${s.port}`, `:${s.port}`, `port=${s.port}`, `listens on ${s.port}`]));
  if (s.image) f.push(pick([`${s.image} container`, `image ${s.image}`, `using ${s.image}`, `from ${s.image}`, `running ${s.image}`, `docker image ${s.image}`]));
  if (s.command) f.push(`${pick(["run locally with", "started by", "command:", "runs `"])}${/`$/.test("x") ? "" : ""} ${pick(["`" + s.command + "`", '"' + s.command + '"', "'" + s.command + "'"])}`.replace(/runs `\s/, "runs ").replace("runs `", "runs ") + pick([", no docker", ", no image and no Dockerfile", ", nothing in docker", ""]));
  if (s.healthCheckPath) f.push(pick([`health ${s.healthCheckPath}`, `health check ${s.healthCheckPath}`, `health check at ${s.healthCheckPath}`, `health path ${s.healthCheckPath}`, `with a ${s.healthCheckPath} endpoint for health`, `probe ${s.healthCheckPath}`, `healthcheck: ${s.healthCheckPath}`]));
  else if (s.image && chance(0.65)) f.push(pick(["no http health", "no health path", "not HTTP so no health check", "no health check", "it doesn't speak HTTP"]));
  if (s.basePath) f.push(pick([`under ${s.basePath}`, `base path ${s.basePath}`, `served from ${s.basePath}`, `at ${s.basePath}`]));
  if (s.replicas) f.push(pick([`${s.replicas} replicas`, `replicas: ${s.replicas}`, `scaled to ${s.replicas}`, `${s.replicas} instances`]));
  if (s.agent) f.push(pick(["keeps checkpoints in files", "checkpoints in files", "durability: files", "stores sessions in files"]));
  if (s.restart) f.push(pick({ no: ["should never restart after exiting", "must not restart after it exits", "restart: no", "one-shot, don't restart it", "no restarts"], "on-failure": ["restart only on failure", "restart: on-failure", "only restart if it fails"], always: ["always restart", "restart: always", "restart it always"] }[s.restart]));
  if (s.exposeViaProxy === false) f.push(pick(["don't route it through traefik", "no traefik route", "skip the proxy route", "not exposed via the proxy"]));
  if (s.enabled === false) f.push(pick(["disabled", "off for now", "(disabled)", "paused", "switched off", "not enabled yet"]));
  if (s.env) { const [k, v] = Object.entries(s.env)[0]; f.push(pick([`env ${k}=${v}`, `with ${k} set to ${v}`, `${k}=${v}`])); }
  if (s.dependsOn) { const d = s.dependsOn; const L = d.length === 1 ? d[0] : chance(0.5) ? d.join(" and ") : d.join(", "); f.push(pick([`depends on ${L}`, `needs ${L}`, `requires ${L}`, `depends on ${L}`])); }
  return f;
}
const shuffle = (a) => (chance(0.6) ? a.slice().sort(() => r() - 0.5) : a);
const sep = () => pick([", ", ", ", " ", "; ", " - ", ", and "]);
const VERBS = ["Write a Flisk service.json for", "Create the service.json for", "Make", "Add", "Set up", "I need", "I want", "We need", "Can you set up", "Could you write the manifest for", "Give me", "Please create", "spin up", "Generate the Flisk config for", "can u make", "Define"];
const SUFFIX = ["", "", "", " pls", " thanks", " asap", "!", " Reply with the JSON only.", " JSON only.", " Just the JSON.", " No commentary.", " Output only JSON please."];
const PREFIX = ["", "", "", "Hey, ", "hi! ", "quick one: ", "ok so ", "Flisk question: "];
function singleNl(s) {
  const tw = typeWord(s), nm = nameP(s.appName), F = shuffle(facts(s));
  let t;
  const frame = int(0, 8);
  if (frame <= 3) t = `${pick(VERBS)} ${art(tw)} ${tw} ${nm}${F.length ? sep() + F.join(sep()) : ""}`;
  else if (frame === 4) t = `${tw} ${s.appName}${F.length ? " " + F.join(" ") : ""}`;
  else if (frame === 5) { const lines = [`name: ${s.appName}`, `type: ${tw}`, ...Object.entries({ stack: s.stack, port: s.port, image: s.image, command: s.command, health: s.healthCheckPath, replicas: s.replicas, basePath: s.basePath, restart: s.restart, enabled: s.enabled === false ? "false" : undefined, dependsOn: s.dependsOn?.join(", ") }).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`)]; if (s.exposeViaProxy === false) lines.push("exposeViaProxy: false"); if (s.agent) lines.push("agent durability: files"); if (s.env) lines.push(`env: ${Object.entries(s.env)[0].join("=")}`); t = lines.join("\n"); }
  else if (frame === 6) t = `${s.stack ? s.stack + ": " : ""}${tw} ${s.appName}${facts(s, false).length ? sep() + shuffle(facts(s, false)).join(sep()) : ""}`;
  else if (frame === 7) t = `What should the service.json for ${art(tw)} ${tw} ${nm} look like${F.length ? "? It is " + F.join(sep()) : "?"}`;
  else t = `${pick(["I'd like", "We're adding", "Our team needs", "Hey! Could you put together the config for"])} ${art(tw)} ${tw} ${nm}${F.length ? sep() + F.join(sep()) : ""}`;
  t = pick(PREFIX) + t + pick(SUFFIX);
  if (chance(0.15)) t = t.toLowerCase();
  if (chance(0.05)) t = t.replace(/\.$/, "");
  return t;
}
function stackNl(svcs) {
  const S = svcs[0].stack;
  const parts = svcs.map((s) => { const tw = typeWord(s); return `${art(tw)} ${tw} ${nameP(s.appName)}${facts(s, false).length ? sep() + shuffle(facts(s, false)).join(sep()) : ""}`; });
  const end = pick([" Reply with a JSON array and nothing else.", " Return a JSON array.", " JSON array please.", ` Give me a JSON array of the ${svcs.length} service.json files.`, " Just the array."]);
  const j = pick(["; ", "; ", ", then ", ". "]);
  const fr = int(0, 4);
  let t = fr === 0 ? `Write the Flisk service.json files for a "${S}" stack: ${parts.join("; ")}.` : fr === 1 ? `Set up the '${S}' stack for me: ${parts.join(j)}.` : fr === 2 ? `stack ${S}: ${parts.join(j)}.` : fr === 3 ? `For the ${S} stack I need: ${parts.join(j)}.` : `Build the ${S} stack in Flisk. ${parts.map((p, i) => `(${i + 1}) ${p}`).join(" ")}`;
  t = pick(PREFIX) + t + end;
  return chance(0.1) ? t.toLowerCase() : t;
}
function stackSpecs() {
  const stack = pick(STACKS), n = int(2, 5), used = new Set(), out = [];
  for (let i = 0; i < n; i++) {
    let s; do { s = good(); } while (used.has(s.appName) || s.command);
    used.add(s.appName); s.stack = stack; delete s.dependsOn; delete s.enabled;
    if (i > 0) s.dependsOn = [out[int(0, i)].appName];
    out.push(sorted(s));
  }
  return out.filter((s) => !validateService(s).errors.length);
}
const BREAKS = [
  (s) => { const { stack, ...x } = s; return stack ? { bad: x, good: sorted({ ...s, stack: "default" }) } : null; },
  (s) => ({ bad: { ...s, schemaVersion: pick([0, 2, 3]) }, good: s }),
  (s) => (s.command ? { bad: { ...s, image: "node:22" }, good: s } : null),
  (s) => (s.env ? { bad: { ...s, env: { [Object.keys(s.env)[0]]: 3 } }, good: { ...s, env: { [Object.keys(s.env)[0]]: "3" } } } : null),
  (s) => (s.image || s.agent || s.basePath ? { bad: { ...s, appType: 7 }, good: s } : null),
];
function repair() { for (;;) { const s = good(); const b = pick(BREAKS)(s); if (b && validateService(b.bad).errors.length) return b; } }
function repairNl(bad) {
  const js = chance(0.5) ? JSON.stringify(bad) : JSON.stringify(bad, null, 2), err = validateService(bad).errors.join("; ");
  return pick([
    `This Flisk service.json is rejected:\n${js}\n\nThe validator says:\n${err}\n\nFix it with the smallest change that makes it valid, keeping every other field. Reply with the corrected JSON object only.`,
    `Flisk is rejecting this one: ${js}\nValidator output: ${err}\nGive me the fixed JSON.`,
    `this config fails validation, help: ${js}\n${err}`,
    `Why won't this start? ${js}\nerror: ${err}\nfix pls:`,
    `fix pls: ${js}\n(${err})`,
    `Here is a service.json that Flisk rejected:\n${js}\nFlisk says: ${err}\nCan you fix it? Just give me the corrected JSON.`,
  ]);
}

// ---- build
const msg = (u, a) => JSON.stringify({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: u }, { role: "assistant", content: a }] });
const N = { single: 1800, stack: 750, repair: 450 };
const seen = new Set(), train = [], valid = [];
const add = (u, a, i) => { if (seen.has(u) || wildPrompts.has(u)) return; seen.add(u); (i % 14 === 0 ? valid : train).push(msg(u, a)); };
for (let i = 0; i < N.single; i++) { const s = good(); add(singleNl(s), JSON.stringify(s), i); }
for (let i = 0; i < N.stack; i++) { const sv = stackSpecs(); if (sv.length >= 2) add(stackNl(sv), JSON.stringify(sv), i); }
for (let i = 0; i < N.repair; i++) { const { bad, good: g } = repair(); add(repairNl(bad), JSON.stringify(g), i); }
// keep some of the first generator's rigid style, so nothing it learned is lost
const old = readFileSync("data/train.jsonl", "utf-8").trim().split("\n");
for (let i = 0; i < 650; i++) { const l = old[Math.floor(r() * old.length)]; const m = JSON.parse(l); const names = m.messages[2].content; if (![...banned].some((b) => names.includes(`"${b}"`))) { if (!seen.has(m.messages[1].content)) { seen.add(m.messages[1].content); train.push(l); } } }
train.sort(() => r() - 0.5);
mkdirSync("data-v3", { recursive: true });
writeFileSync("data-v3/train.jsonl", train.join("\n") + "\n"); writeFileSync("data-v3/valid.jsonl", valid.join("\n") + "\n");
const all = train.join("\n");
console.log(`train ${train.length}, valid ${valid.length}`);
console.log(`wild prompts found verbatim in training: ${[...wildPrompts].filter((p) => all.includes(JSON.stringify(p).slice(1, -1))).length}`);
console.log(`banned names appearing in training targets: ${[...banned].filter((b) => all.includes(`\\"appName\\":\\"${b}\\"`) || all.includes(`\\"${b}\\"`)).length}`);
console.log("--- samples:"); for (const l of train.slice(0, 12)) console.log("  " + JSON.parse(l).messages[1].content.replace(/\n/g, " ⏎ ").slice(0, 170));
