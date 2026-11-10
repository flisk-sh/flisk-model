// FLISK_REPO=/path/to/flisk node --test lib/   (or: bun test lib/)
import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreSingle, scoreStack } from "./score.mjs";

const api = { schemaVersion: 1, appName: "orders-api", appType: "backend", stack: "shop", port: 4000 };
const db = { schemaVersion: 1, appName: "postgres", appType: "database", stack: "shop", framework: "postgres" };
const task = { kind: "stack", services: [{ appName: "orders-api" }, { appName: "postgres" }] };

test("a stack with a plain dependsOn name scores as valid", () => {
  assert.deepEqual(scoreStack([{ ...api, dependsOn: ["postgres"] }, db], task), []);
});

test("a stack whose dependency uses the object form scores as valid", () => {
  const answer = [{ ...api, dependsOn: [{ name: "postgres", condition: "service_healthy" }] }, db];
  assert.deepEqual(scoreStack(answer, task), []);
});

test("an object-form dependency on a service not in the stack is still unknown", () => {
  const problems = scoreStack([{ ...api, dependsOn: [{ name: "redis" }] }, db], task);
  assert.ok(problems.includes('orders-api: depends on unknown "redis"'), problems.join("\n"));
});

test('"dependsOn": "postgres" (a string) is a scored failure, not a crash', () => {
  for (const dependsOn of ["postgres", 7, null, { name: "postgres" }]) {
    let problems;
    assert.doesNotThrow(() => { problems = scoreStack([{ ...api, dependsOn }, db], task); }, JSON.stringify(dependsOn));
    assert.ok(problems.some((p) => p.startsWith("orders-api: service.json.dependsOn")), `${JSON.stringify(dependsOn)}: ${problems.join("\n")}`);
  }
});

test("a non-object single answer is a scored failure, not a crash", () => {
  for (const answer of [null, "backend", 7]) {
    let problems;
    assert.doesNotThrow(() => { problems = scoreSingle(answer, { expect: { appType: "backend" }, mustHave: ["port"] }); });
    assert.notDeepEqual(problems, []);
  }
});
