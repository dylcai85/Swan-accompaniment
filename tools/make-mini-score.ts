// Writes tests/fixtures/mini-score.mid. Run with `npm run fixtures:mini` after changing tools/mini-score.ts.
import { writeFileSync } from 'node:fs';
import { buildMiniScore } from './mini-score';

const OUT = 'tests/fixtures/mini-score.mid';
const bytes = buildMiniScore();
writeFileSync(OUT, bytes);
console.log(`wrote ${OUT} (${bytes.length} bytes)`);
