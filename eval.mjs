// node eval.mjs --base-url http://localhost:11434/v1 --model qwen2.5-coder:7b [--out evals/results.json]
// Any OpenAI-compatible server works. Each task scores: JSON parses, the Flisk validator accepts it,
// every expected field matches, no forbidden field is present. Also reports output tokens, the number Particle optimises.
import { readFileSync, writeFileSync } from "node:fs";
import { validateService } from "./lib/validate.mjs";
import { SYSTEM } from "./lib/templates.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const baseUrl = arg("base-url", "http://localhost:11434/v1");
const model = arg("model");
if (!model) { console.error("usage: node eval.mjs --model <name> [--base-url <url>] [--out <file>]"); process.exit(2); }
const headers = { "content-type": "application/json", ...(process.env.OPENAI_API_KEY ? { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}) };

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  return start > -1 && end > start ? body.slice(start, end + 1) : body;
}

const tasks = JSON.parse(readFileSync(new URL("./evals/tasks.json", import.meta.url), "utf-8"));
const results = [];
for (const task of tasks) {
  let text = "", tokens = 0, error;
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", headers,
      body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: task.prompt }] }),
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
    try { parsed = JSON.parse(extractJson(text)); } catch { problems.push("not valid JSON"); }
    if (parsed) {
      problems.push(...validateService(parsed).errors);
      for (const [k, v] of Object.entries(task.expect)) {
        if (JSON.stringify(parsed[k]) !== JSON.stringify(v)) problems.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(parsed[k])}`);
      }
      for (const k of task.absent ?? []) if (k in parsed) problems.push(`${k}: must not be present`);
    }
  }
  results.push({ id: task.id, pass: problems.length === 0, tokens, problems });
  console.log(`${problems.length === 0 ? "PASS" : "FAIL"} ${task.id} (${tokens} tokens)${problems.length ? "\n  " + problems.join("\n  ") : ""}`);
}
const passed = results.filter((r) => r.pass).length;
const totalTokens = results.reduce((n, r) => n + r.tokens, 0);
console.log(`\n${model}: ${passed}/${results.length} passed, ${totalTokens} output tokens`);
const out = arg("out");
if (out) writeFileSync(out, JSON.stringify({ model, passed, total: results.length, totalTokens, results }, null, 2));
process.exit(passed === results.length ? 0 : 1);
