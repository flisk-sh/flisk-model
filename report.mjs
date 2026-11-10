// node report.mjs : builds RESULTS.md from evals/results/*.json (written by eval.mjs --out) and evals/models.json (labels).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
const models = JSON.parse(readFileSync("evals/models.json", "utf-8"));
const group = (id) => (id.startsWith("b-single") ? "single" : id.startsWith("b-stack") ? "stack" : "repair");
const pct = (a, b) => `${a}/${b}`;
const rows = [];
for (const m of models) {
  const f = `evals/results/${m.file}`;
  if (!existsSync(f)) { rows.push({ ...m, missing: true }); continue; }
  const r = JSON.parse(readFileSync(f, "utf-8"));
  const g = { single: [0, 0], stack: [0, 0], repair: [0, 0] };
  for (const t of r.results) { const k = group(t.id); g[k][1]++; if (t.pass) g[k][0]++; }
  const avgTok = r.totalTokens ? Math.round(r.totalTokens / r.total) : null;
  const wf = m.wild && existsSync(`evals/results/${m.wild}`) ? JSON.parse(readFileSync(`evals/results/${m.wild}`, "utf-8")) : null;
  const w2 = m.wild2 && existsSync(`evals/results/${m.wild2}`) ? JSON.parse(readFileSync(`evals/results/${m.wild2}`, "utf-8")) : null;
  rows.push({ ...m, passed: r.passed, total: r.total, g, avgTok, wildPassed: wf ? wf.passed : null, wildTotal: wf ? wf.total : null, w2Passed: w2 ? w2.passed : null, w2Total: w2 ? w2.total : null });
}
rows.sort((a, b) => (b.w2Passed ?? -1) - (a.w2Passed ?? -1) || (b.passed ?? -1) - (a.passed ?? -1));
const lines = [
  "| Model | What it is | Machine-written (62) | Natural set 1 (26, development) | **Natural set 2 (29, clean)** | Avg answer length |",
  "|---|---|---|---|---|---|",
  ...rows.map((r) => r.missing
    ? `| ${r.label} | ${r.kind} | not run yet | | | |`
    : `| **${r.label}** | ${r.kind} | **${r.passed}** (${Math.round((100 * r.passed) / r.total)}%) | ${r.wildTotal ? `**${r.wildPassed}** (${Math.round((100 * r.wildPassed) / r.wildTotal)}%)` : "not run"} | ${r.w2Total ? `**${r.w2Passed}** (${Math.round((100 * r.w2Passed) / r.w2Total)}%)` : "not run"} | ${r.avgTok ? `${r.avgTok} tokens` : "not measured"} |`),
];
const out = `# Results

Three held-out tests, never trained on. **Machine-written (62):** generated from specs, phrasing and names unseen in training. **Natural set 1 (26):** written by hand in casual, messy wording; now a development set, because I tuned the generator after seeing its failures. **Natural set 2 (29, clean):** written by hand and committed *before* the generator was widened. This is the fair one. How the tests work is in [TESTS.md](TESTS.md).

${lines.join("\n")}

**Passed** means every rule for that question held (see TESTS.md). Re-graded on 2026-11-10: the grader now also checks appType, port, stack and dependsOn against Flisk's published schema. Every row was run again, gave the same answers as before, and was graded on those. It cost Claude Haiku and Sonnet one question each on natural set 2 (appType "container", which is not a Flisk type) and the plain Qwen models three each. **Avg answer length** is the model's own output tokens per question: fewer is cheaper and faster.

How each row was run:
${models.map((m) => `- **${m.label}**: ${m.how}`).join("\n")}

Read this honestly: 62 questions is a small test, it measures one narrow job (writing Flisk config files), and Claude Haiku and Sonnet are far larger general models. The point is how close a small model can get to them on this one job, and at what cost.
`;
writeFileSync("RESULTS.md", out);
console.log(out);
