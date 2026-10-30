// node build-dataset.mjs <root>... : collect real service.json files, keep the ones the Flisk validator accepts,
// write chat-format JSONL (data/train.jsonl, data/valid.jsonl) that mlx-lm and most trainers read.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { validateService } from "./lib/validate.mjs";
import { describe, SYSTEM } from "./lib/templates.mjs";

const SKIP = new Set(["node_modules", ".git", ".flisk-out", ".flisk", "dist"]);
function* walk(dir, depth = 0) {
  if (depth > 8) return;
  let names;
  try { names = readdirSync(dir); } catch { return; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = lstatSync(p); } catch { continue; } // broken symlinks and races are skipped
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) yield* walk(p, depth + 1);
    else if (name === "service.json") yield p;
  }
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("usage: node build-dataset.mjs <root> [root...]");
  process.exit(2);
}
const seen = new Set();
const rows = [];
let invalid = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    let s;
    try { s = JSON.parse(readFileSync(file, "utf-8")); } catch { invalid++; continue; }
    if (validateService(s).errors.length) { invalid++; continue; }
    const key = createHash("sha1").update(JSON.stringify(s)).digest("hex");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, s });
  }
}
// Split by hash so a file never lands in both sets, whatever the walk order.
const isValid = (key) => parseInt(key.slice(0, 2), 16) < 26; // about 10%
const out = { train: [], valid: [] };
for (const { key, s } of rows) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: describe(s) },
    { role: "assistant", content: JSON.stringify(s, null, 2) },
  ];
  out[isValid(key) ? "valid" : "train"].push(JSON.stringify({ messages }));
}
for (const [name, lines] of Object.entries(out)) writeFileSync(`data/${name}.jsonl`, lines.join("\n") + (lines.length ? "\n" : ""));
console.log(`unique valid: ${rows.length}, skipped invalid/unreadable: ${invalid}, train: ${out.train.length}, valid: ${out.valid.length}`);
