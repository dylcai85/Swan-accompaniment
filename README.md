# Swan accompaniment

A browser app that listens to a cellist through the microphone, follows their place in *The Swan* (Saint-Saëns), and plays the piano accompaniment in sync, adapting to rubato in real time.
Start with [`CLAUDE.md`](CLAUDE.md) (stack, architecture, hard rules) and [`docs/PLAN.md`](docs/PLAN.md) (milestones, gates, risks).
The score itself is not in this repo: see [`docs/LOCAL_FILES.md`](docs/LOCAL_FILES.md); open items for Dylan are in [`docs/INPUTS.md`](docs/INPUTS.md).

## Develop

Node 22 (`.nvmrc`). `npm ci`, then: `npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run score:inspect` · `npm run eval` · `npm run check:no-score` (run before every commit: fails if a score file is tracked or in `dist/`).
Deployed by GitHub Actions to https://dylcai85.github.io/Swan-accompaniment/ on every push to `main`.
