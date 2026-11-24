// FLISK_REPO=/path/to/flisk node --test lib/   (or: bun test lib/)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { scoreSingle, scoreStack } from "./score.mjs";

const api = { schemaVersion: 1, appName: "orders-api", appType: "backend", stack: "shop", port: 4000 };
const db = { schemaVersion: 1, appName: "orders-db", appType: "database", stack: "shop", framework: "postgres" };
const task = { kind: "stack", services: [{ appName: "orders-api" }, { appName: "orders-db" }] };

test("a stack with a plain dependsOn name scores as valid", () => {
  assert.deepEqual(scoreStack([{ ...api, dependsOn: ["orders-db"] }, db], task), []);
});

test("a stack whose dependency uses the object form scores as valid", () => {
  const answer = [{ ...api, dependsOn: [{ name: "orders-db", condition: "service_healthy" }] }, db];
  assert.deepEqual(scoreStack(answer, task), []);
});

test("the two-deps question accepts the same names in reverse order", () => {
  const tasks = JSON.parse(readFileSync(new URL("../evals/tasks-hard.json", import.meta.url), "utf8"));
  const question = tasks.find(({ id }) => id === "two-deps");
  const answer = {
    schemaVersion: 1, stack: "shop", ...question.expect,
    dependsOn: ["payments-api", "orders-api"],
  };

  assert.deepEqual(scoreSingle(answer, question), []);
  assert.deepEqual(answer.dependsOn, ["payments-api", "orders-api"]);
  assert.deepEqual(question.expect.dependsOn, ["orders-api", "payments-api"]);
});

test("stack scoring also ignores dependency order but still checks all names", () => {
  const cache = { ...db, appName: "orders-cache" };
  const question = {
    ...task,
    services: [
      { appName: api.appName, dependsOn: [db.appName, cache.appName] },
      { appName: db.appName }, { appName: cache.appName },
    ],
  };
  const score = (dependsOn) => scoreStack([{ ...api, dependsOn }, db, cache], question);

  assert.deepEqual(score([cache.appName, db.appName]), []);
  assert.ok(score([cache.appName]).some((p) => p.startsWith(`${api.appName}.dependsOn:`)));
  assert.ok(score([cache.appName, cache.appName]).some((p) => p.startsWith(`${api.appName}.dependsOn:`)));
});

test("an object-form dependency on a service not in the stack is still unknown", () => {
  const problems = scoreStack([{ ...api, dependsOn: [{ name: "redis" }] }, db], task);
  assert.ok(problems.includes('orders-api: depends on unknown "redis"'), problems.join("\n"));
});

test('"dependsOn": "orders-db" (a string) is a scored failure, not a crash', () => {
  for (const dependsOn of ["orders-db", 7, null, { name: "orders-db" }]) {
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
