import assert from 'node:assert/strict';
import test from 'node:test';
import { findStaleRoadmapStatements } from './check-roadmap-status.mjs';

test('flags the old laptop and live-7B statements', () => {
  const problems = findStaleRoadmapStatements(
    'Inference service: live, but it runs on one Mac behind a tunnel. The live model is still the prompted 7B. 17/29.',
  );
  assert.ok(problems.some((problem) => problem.includes('Mac behind a tunnel')));
  assert.ok(problems.some((problem) => problem.includes('prompted 7B')));
  assert.ok(problems.some((problem) => problem.includes('Cloudflare Worker')));
  assert.ok(problems.some((problem) => problem.includes('not served')));
});

test('accepts current Cloudflare status', () => {
  const problems = findStaleRoadmapStatements(
    'Inference service: a Cloudflare Worker with D1 and Workers AI; 17/29 is the trained 1.5B, which is not served. The hosted 32B has no score yet.',
  );
  assert.deepEqual(problems, []);
});
