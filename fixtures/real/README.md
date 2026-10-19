# Real cello takes

Recordings of Dylan playing the cello part of *The Swan*, used by `npm run eval` (M4/M5) to measure the score follower on real audio. Reference alignment comes from the offline DTW aligner, not hand annotation.

**Where they live:** this folder **only if Dylan has confirmed the takes may be committed** (the repo is public). Otherwise they go in `local/takes/` (gitignored) with the same names, and are attached to a cloud session when needed. The decision is tracked in `docs/INPUTS.md`.

## Recording conditions

- Cello only. No piano playing (in the room or in headphones that the mic could pick up).
- Same mic, mic position, and room as live use. Ideally record with the app's **Record take** button (M4), so the takes go through the same capture chain (no echo cancellation, noise suppression or AGC).
- Start from the top of the Swan (the cello enters at bar 2; start playing at your own count).
- Leave ~1-2 s of silence before the first note and after the last.
- Mono is fine. FLAC (or OGG) preferred, WAV only if needed. Keep each file under ~5 MB. No Git LFS.

## Expected takes

| File | Content |
|---|---|
| `01-steady-65bpm.flac` | Steady, comfortable tempo, ~65 bpm quarter |
| `02-expressive.flac` | Generous rubato, ritardandos at phrase ends |
| `03-slow-50bpm.flac` | Slow, ~50 bpm |
| `04-mistake-bar8.flac` | Wrong note around bar 8, stop for one bar, then resume |
| `05a-room-noise-10s.flac` | 10 s of silence: room noise only |
| `05b-open-a-5s.flac` | Open A string for 5 s (tuning reference) |

## Naming convention

`NN[x]-<kind>[-<detail>].<ext>`: two-digit take number from the list above, optional letter for sub-takes, a lowercase kebab-case kind, and an optional detail (tempo, bar, length). Re-recordings add a date suffix and replace the old take in eval: `02-expressive-2026-11-03.flac`. Additional takes continue the numbering (`06-...`) and are described in a row added to the table above.
