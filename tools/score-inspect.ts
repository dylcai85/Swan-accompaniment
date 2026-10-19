// M0 stub. M1 replaces this with the bar-by-bar table from the parsed score.
import { existsSync } from 'node:fs';

const SCORE = 'local/swan.mid';

if (!existsSync(SCORE)) {
  console.log(`SKIP: ${SCORE} not found. Attach swan.mid to this session and place it at ${SCORE} (see docs/LOCAL_FILES.md).`);
} else {
  console.log(`${SCORE} is present. Score parsing arrives in M1.`);
}
