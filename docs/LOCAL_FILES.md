# Local-only files

Some files this project needs are third-party or personal, so they live in `local/` and are **never committed** (not even once: git history keeps them forever). `local/` is gitignored, as are `*.mid`, `*.midi`, `*.mxl`, `*.musicxml` and `docs/reference/` anywhere in the tree. The only committed MIDI is the original, made-up `tests/fixtures/mini-score.mid`.

| Path | What | Needed for |
|---|---|---|
| `local/swan.mid` | The Swan MIDI (cello + 2 piano parts, from MFiles, license unverified) | `npm run score:inspect`, real-score tests, `npm run eval` on the real piece |
| `local/swan-score.pdf` | Printed score (cello + piano), for checking the MIDI by eye | M1 spot check |
| `local/takes/` | Dylan's cello recordings, unless he decides they may be committed to `fixtures/real/` (see `docs/INPUTS.md`) | M4/M5 eval |

Generated audio derived from the real score goes in `fixtures/synthetic/` or `fixtures/derived/`, which are also gitignored.

## Rules

- Never put these files under `public/`: Vite deploys everything there.
- Never commit anything that reproduces the piece's note content: golden note lists, JSON/CSV dumps, bar tables, rendered score audio. Tests against the real score compute from `local/swan.mid` at run time and assert only on aggregates (counts, ranges, positions).
- Before every commit run `git status` and check that no `.mid`, `.pdf` or score-derived file is staged.
- Tests and `npm run eval` that need the real score **skip with a clear message** when `local/swan.mid` is absent. CI never has it.
- The deployed app never contains the score. It is loaded in the browser through a file picker and cached in IndexedDB.

## Cloud sessions

Each cloud session starts from a fresh clone, so `local/` is empty. **If a session needs the real score, Dylan must attach `swan.mid` (and the PDF or takes if relevant) to that session again**, and Claude places it at `local/swan.mid`. Any claim about the real piece (note counts, bar table, eval metrics) must say whether the real score was present when it was produced.
