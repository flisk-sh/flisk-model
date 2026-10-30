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
  rows.push({ ...m, passed: r.passed, total: r.total, g, avgTok, wildPassed: wf ? wf.passed : null, wildTotal: wf ? wf.total : null });
}
rows.sort((a, b) => (b.passed ?? -1) - (a.passed ?? -1));
const lines = [
  "| Model | What it is | Machine-written test (62) | Natural-wording test (26) | Single | Stack | Repair | Avg answer length |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => r.missing
    ? `| ${r.label} | ${r.kind} | not run yet | | | | | |`
    : `| **${r.label}** | ${r.kind} | **${r.passed}** (${Math.round((100 * r.passed) / r.total)}%) | ${r.wildTotal ? `**${r.wildPassed}** (${Math.round((100 * r.wildPassed) / r.wildTotal)}%)` : "not run"} | ${pct(...r.g.single)} | ${pct(...r.g.stack)} | ${pct(...r.g.repair)} | ${r.avgTok ? `${r.avgTok} tokens` : "not measured"} |`),
];
const out = `# Results

Two held-out tests, never trained on. **Machine-written (62):** generated from specs with phrasing and names unseen in training. **Natural wording (26):** written by hand in casual, terse and messy wording, with typos. How the tests work is in [TESTS.md](TESTS.md).

${lines.join("\n")}

**Passed** means every rule for that question held (see TESTS.md). **Avg answer length** is the model's own output tokens per question: fewer is cheaper and faster.

How each row was run:
${models.map((m) => `- **${m.label}**: ${m.how}`).join("\n")}

Read this honestly: 62 questions is a small test, it measures one narrow job (writing Flisk config files), and Claude Haiku and Sonnet are far larger general models. The point is how close a small model can get to them on this one job, and at what cost.
`;
writeFileSync("RESULTS.md", out);
console.log(out);
