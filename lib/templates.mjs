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

// A Flisk-aware prompt for models that have never seen Flisk. The rules come from runtime/engine/schemas/service-schema.json.
// The worked examples use names and values that do not appear in evals/tasks.json.
export const SYSTEM_V2 = `You write Flisk service.json files. Reply with one JSON object and nothing else.

Rules:
- Always include "schemaVersion": 1, "appName", "appType" and "stack".
- "appType" is exactly one of: backend, frontend, sdk, worker, migrator, library, mcp, agent, bring-your-own. Never invent another value.
  A container image or an existing service is "bring-your-own". An HTTP API is "backend". A background job runner is "worker". A database migration job is "migrator".
- "appName" is lowercase letters, digits and hyphens. "port" is an integer. "healthCheckPath" starts with "/".
- "dependsOn" is an array of resource names.
- bring-your-own: "image" is a Docker image name. "restart" is one of no, on-failure, unless-stopped, always: use "no" for a job that must not restart. "exposeViaProxy": false turns off the Traefik route. Leave "healthCheckPath" out for a service that does not speak HTTP.
- "command" runs the service as a local process (for example "node server.js"). With "command", do not set "image" or "dockerfile". "stack" is then optional.
- "basePath" is the URL path a frontend is served under, for example "/admin". "replicas" is an integer. "enabled": false switches a resource off.
- "env" is an object of string values, for example {"LOG_LEVEL": "debug"}, and goes with "command".
- An agent keeps its checkpoints with "agent": {"durability": "files"}.
- When the request names a stack for several services, every service in the answer gets that same "stack" value. Never leave "stack" out unless the service uses "command".
- When asked for several services, reply with a JSON array of objects instead of one object.
- Only set fields the request asks for, plus the required four.`;

const shot = (user, svc) => [
  { role: "user", content: user },
  { role: "assistant", content: JSON.stringify({ schemaVersion: 1, ...svc }, null, 2) },
];

export const FEW_SHOTS = [
  ...shot('Write a Flisk service.json for an HTTP API backend called "billing-api" in the "pay" stack on port 4300 with health check /healthz. Reply with the JSON only.',
    { appName: "billing-api", appType: "backend", stack: "pay", port: 4300, healthCheckPath: "/healthz" }),
  ...shot('Write a Flisk service.json for an existing container called "search" in the "pay" stack using the image opensearchproject/opensearch:2 on port 9200 that must not restart after it exits. Reply with the JSON only.',
    { appName: "search", appType: "bring-your-own", stack: "pay", image: "opensearchproject/opensearch:2", port: 9200, restart: "no" }),
  ...shot('Write a Flisk service.json for a background worker called "invoicer" in the "pay" stack that depends on "billing-api". Reply with the JSON only.',
    { appName: "invoicer", appType: "worker", stack: "pay", dependsOn: ["billing-api"] }),
  ...shot('Write a Flisk service.json for a frontend called "admin-ui" that runs locally with the command "bun run dev" on port 5173, no image and no Dockerfile. Reply with the JSON only.',
    { appName: "admin-ui", appType: "frontend", command: "bun run dev", port: 5173 }),
  {
    role: "user",
    content: 'Write the Flisk service.json files for a "pay" stack: a bring-your-own Redis called "pay-cache" (image redis:7, port 6379, no health path) and an HTTP API backend called "pay-api" on port 4300 that depends on "pay-cache". Reply with a JSON array of the two objects and nothing else.',
  },
  {
    role: "assistant",
    content: JSON.stringify(
      [
        { schemaVersion: 1, appName: "pay-cache", appType: "bring-your-own", stack: "pay", image: "redis:7", port: 6379 },
        { schemaVersion: 1, appName: "pay-api", appType: "backend", stack: "pay", port: 4300, dependsOn: ["pay-cache"] },
      ],
      null,
      2,
    ),
  },
];
