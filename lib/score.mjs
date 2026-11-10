// Grades one parsed answer against its task. Used by eval.mjs; kept here so the tests can call it.
import { validateService } from "./validate.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The service a dependsOn entry names: a string as it is, or the `name` of the object form ({ name, condition }). */
export function dependencyName(entry) {
  if (typeof entry === "string") return entry;
  if (isObject(entry) && typeof entry.name === "string") return entry.name;
  return null;
}

export function scoreSingle(parsed, task, problems = []) {
  problems.push(...validateService(parsed).errors);
  if (!isObject(parsed)) return problems; // the validator has already said why
  for (const [k, v] of Object.entries(task.expect ?? task.keep ?? {})) {
    if (!same(parsed[k], v)) problems.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(parsed[k])}`);
  }
  for (const k of task.mustHave ?? []) if (!(k in parsed)) problems.push(`${k}: must be present`);
  for (const k of task.absent ?? []) if (k in parsed) problems.push(`${k}: must not be present`);
  return problems;
}

export function scoreStack(parsed, task, problems = []) {
  if (!Array.isArray(parsed)) { problems.push("expected a JSON array"); return problems; }
  const names = new Set(parsed.map((s) => s?.appName));
  if (names.size !== parsed.length) problems.push("duplicate appName");
  for (const want of task.services) {
    const got = parsed.find((s) => s?.appName === want.appName);
    if (!got) { problems.push(`${want.appName}: missing`); continue; }
    for (const [k, v] of Object.entries(want)) if (!same(got[k], v)) problems.push(`${want.appName}.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
  }
  for (const s of parsed) {
    problems.push(...validateService(s).errors.map((e) => `${s?.appName}: ${e}`));
    // A dependsOn that is not a list is already a validator error above; only a list is walked.
    if (!Array.isArray(s?.dependsOn)) continue;
    for (const entry of s.dependsOn) {
      const d = dependencyName(entry);
      if (d !== null && !names.has(d)) problems.push(`${s.appName}: depends on unknown "${d}"`);
    }
  }
  if (parsed.length !== task.services.length) problems.push(`expected ${task.services.length} services, got ${parsed.length}`);
  return problems;
}
