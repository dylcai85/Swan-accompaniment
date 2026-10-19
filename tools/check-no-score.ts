// Guard against committing or deploying third-party score files (CLAUDE.md hard rule 7).
// Checks every file in the git index (tracked + staged) and, if present, the built dist/.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SCORE_FILE = /\.(mid|midi|mxl|musicxml|pdf)$/i;
const ALLOWED = new Set(['tests/fixtures/mini-score.mid']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const problems: string[] = [];

const indexed = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const f of indexed) {
  if (f.startsWith('local/')) problems.push(`in git: ${f} (local/ must never be committed)`);
  else if (SCORE_FILE.test(f) && !ALLOWED.has(f)) problems.push(`in git: ${f}`);
}

if (existsSync('dist')) {
  for (const f of walk('dist')) {
    if (SCORE_FILE.test(f)) problems.push(`in build output: ${relative('.', f)}`);
  }
}

if (problems.length > 0) {
  console.error('check:no-score FAILED. Score files must stay local (see docs/LOCAL_FILES.md):');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check:no-score OK (${indexed.length} indexed files${existsSync('dist') ? ', dist/ scanned' : ''})`);
