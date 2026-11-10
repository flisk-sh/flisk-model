// Scores a service.json with Flisk's own rules, so the eval and the dataset use the same rules `flisk up` does.
// FLISK_REPO points at a flisk checkout with cli/dist built and cli/node_modules installed.
//
// Two checks, both read from that checkout rather than copied here:
// 1. The CLI's validateServiceManifest (cli/dist/utils/service-manifest.js). It deliberately skips appName, appType,
//    stack, port, schemaVersion and dependsOn ("checked elsewhere", see FIELD_KINDS in cli/src/utils/service-manifest.ts),
//    so on its own it accepts appType "api" and port "4300".
// 2. Flisk's published service.json schema (runtime/engine/schemas/service-schema.json, flisk.sh/schema.service.json),
//    compiled with the CLI's own ajv, for exactly those skipped fields: the appType list (kept equal to the CLI's
//    RESOURCE_CONFIG_APP_TYPES by flisk's service-schema-contract test), port as an integer 1-65535, stack as a string,
//    dependsOn as a list of names. The engine's discovery (runtime/discovery/validation.star) stops `flisk up` on the same
//    wrong appType and non-integer port.
//
// Not graded: the schema's per-appType port ranges and conditional requirements (its allOf block). Flisk's own layers
// disagree on them (the schema allows a frontend on 3000-3999, discovery on 3000-5999), so they are not a single rule
// a model could be held to.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.env.FLISK_REPO ?? "../flisk");
const mod = await import(pathToFileURL(`${repo}/cli/dist/utils/service-manifest.js`).href);
const { default: Ajv } = await import(pathToFileURL(`${repo}/cli/node_modules/ajv/dist/ajv.js`).href);
const schema = JSON.parse(readFileSync(`${repo}/runtime/engine/schemas/service-schema.json`, "utf-8"));

/** The fields validateServiceManifest leaves to other layers, checked here with the schema's own definitions. */
export const SCHEMA_FIELDS = ["schemaVersion", "appName", "appType", "stack", "port", "dependsOn"];
const checkFields = new Ajv({ allErrors: true, strict: false }).compile({
  type: "object",
  properties: Object.fromEntries(SCHEMA_FIELDS.map((field) => [field, schema.properties[field]])),
});

// One message per field, and none for a field the CLI already reported, so a repair prompt built from these errors reads
// the way the CLI would print it.
function schemaErrors(value, cliErrors) {
  if (!value || typeof value !== "object" || Array.isArray(value) || checkFields(value)) return [];
  const byField = new Map();
  for (const e of checkFields.errors) {
    const field = e.instancePath.replace(/^\//, "").split("/")[0];
    if (byField.has(field) || cliErrors.some((c) => c.startsWith(`service.json.${field}:`))) continue;
    const detail = e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : "";
    byField.set(field, `service.json.${field}: ${e.message}${detail}`);
  }
  return [...byField.values()];
}

/** @returns {{ errors: string[], warnings: string[] }} */
export function validateService(value) {
  const result = mod.validateServiceManifest(value, "service.json");
  return { ...result, errors: [...result.errors, ...schemaErrors(value, result.errors)] };
}
