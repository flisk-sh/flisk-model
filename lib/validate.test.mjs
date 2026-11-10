// FLISK_REPO=/path/to/flisk node --test lib/   (or: bun test lib/)
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateService } from "./validate.mjs";

const ok = { schemaVersion: 1, appName: "billing-api", appType: "backend", stack: "shop", port: 4300 };
const errors = (patch) => validateService({ ...ok, ...patch }).errors;

test("a correct backend passes", () => {
  assert.deepEqual(errors({}), []);
});

test('appType "api" and port "4300" (accepted before 2026-11-10) are both rejected', () => {
  const found = errors({ appType: "api", port: "4300" });
  assert.ok(found.some((e) => e.startsWith("service.json.appType:") && e.includes("backend")), found.join("\n"));
  assert.ok(found.some((e) => e.startsWith("service.json.port:") && e.includes("integer")), found.join("\n"));
});

test("an appType outside Flisk's list is rejected", () => {
  for (const appType of ["api", "service", "container", "web", "infra"]) assert.notDeepEqual(errors({ appType }), [], appType);
});

test("every appType in Flisk's list is accepted", () => {
  for (const appType of ["frontend", "worker", "migrator", "mcp", "agent", "library", "sdk"]) assert.deepEqual(errors({ appType }), [], appType);
  assert.deepEqual(errors({ appType: "bring-your-own", image: "redis:7", port: 6379 }), []);
  const { port, ...noPort } = ok;
  assert.deepEqual(validateService({ ...noPort, appType: "database", framework: "postgres" }).errors, []);
});

test("port must be an integer from 1 to 65535", () => {
  for (const port of ["4300", 4300.5, 0, 70000, null]) assert.notDeepEqual(errors({ port }), [], JSON.stringify(port));
});

test("stack must be a string and dependsOn a list of names", () => {
  assert.notDeepEqual(errors({ stack: 7 }), []);
  assert.notDeepEqual(errors({ dependsOn: "billing-db" }), []);
  assert.notDeepEqual(errors({ dependsOn: ["Billing DB"] }), []);
  assert.deepEqual(errors({ dependsOn: ["billing-db", { name: "billing-migrate", condition: "service_completed_successfully" }] }), []);
});

test("schemaVersion must be 1", () => {
  assert.notDeepEqual(errors({ schemaVersion: "1" }), []);
  assert.notDeepEqual(errors({ schemaVersion: 2 }), []);
});

test("the CLI's own checks still run", () => {
  const { stack, ...noStack } = ok;
  assert.ok(validateService(noStack).errors.some((e) => e.includes("stack")));
  assert.deepEqual(validateService([ok]).errors, ["service.json: expected a JSON object"]);
});
