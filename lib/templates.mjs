// Turns a service.json into a plain-English request. Deterministic, so the dataset is reproducible.
const KIND = {
  backend: "an HTTP API backend",
  frontend: "a web frontend",
  worker: "a background worker",
  migrator: "a database migration job",
  mcp: "an MCP server",
  agent: "a long-running AI agent",
  "bring-your-own": "an existing container",
  sdk: "a shared SDK package",
  library: "a shared library",
};

export function describe(s) {
  const parts = [`Write a Flisk service.json for ${KIND[s.appType] ?? `a ${s.appType}`} called "${s.appName}"`];
  if (s.stack) parts.push(`in the "${s.stack}" stack`);
  if (s.port) parts.push(`listening on port ${s.port}`);
  if (s.image) parts.push(`using the image ${s.image}`);
  if (s.command) parts.push(`run locally with \`${s.command}\``);
  if (s.healthCheckPath) parts.push(`with health check ${s.healthCheckPath}`);
  if (Array.isArray(s.dependsOn) && s.dependsOn.length) parts.push(`depending on ${s.dependsOn.join(", ")}`);
  return `${parts.join(", ")}. Reply with the JSON only.`;
}

export const SYSTEM =
  "You write Flisk service.json files. Flisk is a local dev runtime: each service has a service.json with schemaVersion 1, appName, appType and stack. Reply with valid JSON only.";
