// node eval.mjs --base-url http://localhost:11434/v1 --model qwen2.5-coder:7b [--out evals/results.json]
// Any OpenAI-compatible server works. Each task scores: JSON parses, the Flisk validator accepts it,
// every expected field matches, no forbidden field is present. Also reports output tokens, the number Particle optimises.
import { readFileSync, writeFileSync } from "node:fs";
import { validateService } from "./lib/validate.mjs";
import { SYSTEM, SYSTEM_V2, FEW_SHOTS } from "./lib/templates.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const baseUrl = arg("base-url", "http://localhost:11434/v1");
const model = arg("model");
if (!model) { console.error("usage: node eval.mjs --model <name> [--base-url <url>] [--out <file>]"); process.exit(2); }
// --prompt v1 is the short prompt (what training data uses); v2 adds the Flisk rules and worked examples.
const promptVersion = arg("prompt", "v1");
const preamble = promptVersion === "v2" ? [{ role: "system", content: SYSTEM_V2 }, ...FEW_SHOTS] : [{ role: "system", content: SYSTEM }];
const headers = { "content-type": "application/json", ...(process.env.OPENAI_API_KEY ? { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}) };

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  return start > -1 && end > start ? body.slice(start, end + 1) : body;
}

const tasks = JSON.parse(readFileSync(new URL(`./evals/${arg("tasks", "tasks")}.json`, import.meta.url), "utf-8"));
const results = [];
const KIND_NOTE = {
  stack: "\n\nThe answer is a JSON array of service.json objects. Every dependsOn entry must name another service in the array.",
  repair: "",
};
function buildPrompt(task) {
  if (!task.broken) return task.prompt;
  const errors = validateService(task.broken).errors.join("\n");
  return `This Flisk service.json is rejected:\n${JSON.stringify(task.broken, null, 2)}\n\nThe validator says:\n${errors}\n\nFix it with the smallest change that makes it valid, keeping every other field. Reply with the corrected JSON object only.`;
}
function extractAny(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const a = body.search(/[\[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return a > -1 && end > a ? body.slice(a, end + 1) : body;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function scoreSingle(parsed, task, problems) {
  problems.push(...validateService(parsed).errors);
  for (const [k, v] of Object.entries(task.expect ?? task.keep ?? {})) {
    if (!same(parsed[k], v)) problems.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(parsed[k])}`);
  }
  for (const k of task.mustHave ?? []) if (!(k in parsed)) problems.push(`${k}: must be present`);
  for (const k of task.absent ?? []) if (k in parsed) problems.push(`${k}: must not be present`);
}
function scoreStack(parsed, task, problems) {
  if (!Array.isArray(parsed)) return problems.push("expected a JSON array");
  const names = new Set(parsed.map((s) => s?.appName));
  if (names.size !== parsed.length) problems.push("duplicate appName");
  for (const want of task.services) {
    const got = parsed.find((s) => s?.appName === want.appName);
    if (!got) { problems.push(`${want.appName}: missing`); continue; }
    for (const [k, v] of Object.entries(want)) if (!same(got[k], v)) problems.push(`${want.appName}.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
  }
  for (const s of parsed) {
    problems.push(...validateService(s).errors.map((e) => `${s?.appName}: ${e}`));
    for (const d of s?.dependsOn ?? []) if (!names.has(d)) problems.push(`${s.appName}: depends on unknown "${d}"`);
  }
  if (parsed.length !== task.services.length) problems.push(`expected ${task.services.length} services, got ${parsed.length}`);
}

for (const task of tasks) {
  let text = "", tokens = 0, error;
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", headers,
      body: JSON.stringify({ model, temperature: 0, messages: [...preamble, { role: "user", content: buildPrompt(task) + (KIND_NOTE[task.kind] ?? "") }] }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const body = await res.json();
    text = body.choices?.[0]?.message?.content ?? "";
    tokens = body.usage?.completion_tokens ?? 0;
  } catch (e) { error = String(e.message ?? e); }
  const problems = [];
  if (error) problems.push(`request failed: ${error}`);
  else {
    let parsed;
    try { parsed = JSON.parse(extractAny(text)); } catch { problems.push("not valid JSON"); }
    if (parsed !== undefined) (task.kind === "stack" ? scoreStack : scoreSingle)(parsed, task, problems);
  }
  results.push({ id: task.id, pass: problems.length === 0, tokens, problems });
  console.log(`${problems.length === 0 ? "PASS" : "FAIL"} ${task.id} (${tokens} tokens)${problems.length ? "\n  " + problems.join("\n  ") : ""}`);
}
const passed = results.filter((r) => r.pass).length;
const totalTokens = results.reduce((n, r) => n + r.tokens, 0);
console.log(`\n${model} (prompt ${promptVersion}): ${passed}/${results.length} passed, ${totalTokens} output tokens`);
const out = arg("out");
if (out) writeFileSync(out, JSON.stringify({ model, prompt: promptVersion, passed, total: results.length, totalTokens, results }, null, 2));
process.exit(passed === results.length ? 0 : 1);
