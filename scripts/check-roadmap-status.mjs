import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findStaleRoadmapStatements(text) {
  const problems = [];

  if (/one Mac behind a tunnel/i.test(text)) {
    problems.push('ROADMAP.md still says the inference service runs on a Mac behind a tunnel');
  }
  if (!/Cloudflare Worker/i.test(text)) {
    problems.push('ROADMAP.md must say inference.flisk.si runs on a Cloudflare Worker');
  }
  if (!/Workers AI/i.test(text)) {
    problems.push('ROADMAP.md must say the hosted model comes from Workers AI');
  }
  if (/live model is still the prompted 7B/i.test(text)) {
    problems.push('ROADMAP.md still calls the prompted 7B the live model');
  }
  if (!/17\/29/.test(text) || !/not served/i.test(text)) {
    problems.push('ROADMAP.md must say the 17/29 score belongs to the trained 1.5B that is not served');
  }

  return problems;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const roadmap = readFileSync(new URL('../ROADMAP.md', import.meta.url), 'utf8');
  const problems = findStaleRoadmapStatements(roadmap);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log('ROADMAP.md inference status is current');
  }
}
