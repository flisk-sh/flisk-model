// node make-modelfile.mjs [base-model] > Modelfile
// Bakes the Flisk rules and worked examples into an Ollama model: `ollama create flisk-wolf -f Modelfile`.
import { SYSTEM_V2, FEW_SHOTS } from "./lib/templates.mjs";
const base = process.argv[2] ?? "qwen2.5-coder:7b";
const q = (text) => `"""${text.replaceAll('"""', '\\"\\"\\"')}"""`;
const lines = [`FROM ${base}`, "PARAMETER temperature 0", `SYSTEM ${q(SYSTEM_V2)}`];
for (const m of FEW_SHOTS) lines.push(`MESSAGE ${m.role} ${q(m.content)}`);
console.log(lines.join("\n"));
