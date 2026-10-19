# Cello Accompanist

A browser app that listens to Dylan playing cello through the microphone, follows where he is in the score, and plays the piano accompaniment in sync, adjusting to his tempo changes (rubato) in real time.

**Current scope:** one piece, *The Swan* (Saint-Saëns), cello + 2 piano parts from a single MIDI file. Everything else (other pieces, YouTube or recorded audio as accompaniment, mobile) is out of scope until the Swan works end to end. See `docs/PLAN.md` for milestones, acceptance gates, and known risks. **Read it before starting any milestone.**

## Tech stack (do not change without asking)

- **Vite + TypeScript (strict)**, no UI framework. Plain DOM modules. If the UI outgrows this, ask before adding Preact.
- **Web Audio API** directly: `AudioContext`, `AudioWorklet`, `getUserMedia`.
- **Tone.js `Sampler` only** for piano sound (Salamander piano samples loaded from a CDN at runtime). Tone's Transport is NOT used. We run our own score clock (see Architecture). Fallback: a simple oscillator synth, used in tests and when offline.
- **@tonejs/midi** to parse MIDI.
- **Vitest** for unit tests. **Playwright** (Chromium is preinstalled in the cloud sandbox; do not run `playwright install`) for end-to-end tests.
- **tsx** to run TypeScript scripts in Node. One language throughout. No Python.
- Hosting: static site, deployed by GitHub Actions. Mic access needs HTTPS (or localhost).
- Add a dependency only with a one-line justification in the commit message and the milestone entry in `docs/MILESTONES.md`. Pin exact versions.

## Commands

```
npm run dev            # local dev server
npm run build          # production build
npm run typecheck
npm test               # vitest unit tests
npm run test:e2e       # playwright, uses a WAV file as a fake microphone
npm run score:inspect  # print tracks, bars, note counts from the MIDI
npm run eval           # alignment eval on fixtures; prints metrics table; non-zero exit if gates fail
```

All of these must pass before pushing to `main`. Keep them working as the repo grows.

## Architecture (the important ideas)

```
mic -> AudioWorklet (frames) -> pitch tracker (pure TS) -> score follower -> {position, rate, confidence}
                                                                              |
score (MIDI) -> piano events in score time -> SCORE CLOCK <------------------+
                                                 |
                                       lookahead scheduler -> Tone Sampler -> headphones
```

- **Score time is MIDI ticks (or beats), never seconds.** The file has PPQ 256 and 6/4 time (one bar = 1536 ticks, derive this from the file, do not hardcode). Seconds only exist at the audio edge.
- **Ignore the tempo events in the MIDI file.** They contain authored rubato (44 changes, ~50-70 bpm). Use one constant nominal tempo (the median) as the baseline. The follower estimates the actual `rate` (performed speed / nominal speed) from Dylan's playing.
- **The score clock** maps score position to audio time: `position(t) = anchorPos + rate * (t - anchorTime)`. The follower never makes the piano jump. It nudges `rate` and anchor so the piano converges on the cello over roughly one beat. Only jump (seek) when the error exceeds a few beats and confidence is high.
- **The scheduler looks ahead ~100-150 ms** and schedules piano notes at exact `AudioContext.currentTime` values. When `rate` changes, unplayed notes are rescheduled. Never schedule far ahead.
- **Pure DSP/follower code lives in plain TS modules operating on `Float32Array`s**, with no browser APIs, so it runs in Vitest and in Node eval scripts. The AudioWorklet is a thin wrapper.
- **Piano must not trigger from mic input.** The mic only feeds the pitch tracker.

## Hard rules

1. **Audio thread:** no allocations, no `console.log`, no object creation inside `AudioWorkletProcessor.process()`. Preallocate buffers. Post results to the main thread in batches.
2. **Sample rate:** always use `audioContext.sampleRate`. Never assume 44100 or 48000.
3. **getUserMedia constraints:** `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, mono. AudioContext `latencyHint: 'interactive'`. Create/resume the context from a click handler (autoplay policy).
4. **Headphones are required** (wired recommended). Speaker bleed corrupts pitch tracking. The UI must say so and show the current latency estimate.
5. **Tuning-agnostic matching.** Dylan's cello may not be at A=440. The follower estimates a global tuning offset (cents) and matches relative to it.
6. **Vite `base`** must match the GitHub Pages path, and the worklet must be loaded via `new URL(..., import.meta.url)` so it works under that base path. Verify with a production build, not just `dev`.
7. **Third-party score files stay LOCAL and are never committed.** The Swan MIDI (from MFiles) and any score PDF/MusicXML live in `local/` (gitignored: `*.mid`, `*.midi`, `*.mxl`, `*.musicxml`, `local/`, `docs/reference/`). Never put them under `public/` (Vite would deploy them), never commit files that reproduce their note content (golden note lists, JSON dumps, rendered score audio), and never commit them even once (history keeps them). Before every commit, check `git status` for stray `.mid`/`.pdf` files. The app loads the score **at runtime through a file picker** and caches it in the browser (IndexedDB); nothing copyrighted ships with the site. Credit Salamander piano (CC-BY 3.0) in the UI footer.
8. **Fixtures stay small:** under ~5 MB each, FLAC or OGG, not WAV, unless needed. No Git LFS.
9. A change to the follower or pitch tracker is not done until `npm run eval` shows no regression versus the previous metrics (see PLAN.md for gates). Paste the before/after table in the commit message and `docs/MILESTONES.md`.

## Testing without a microphone (read this)

The cloud sandbox has no mic or speakers. Do not claim real-time audio "works" because it compiles. Use, in order:
1. **Unit tests** on pure DSP (synthetic sine/sawtooth, vibrato, octave-error cases).
2. **Synthetic performer** (`tools/synth-performer.ts`): renders the cello MIDI to audio with a chosen tempo curve, vibrato, and noise, so ground truth is known exactly.
3. **Fake-mic e2e:** launch Chromium with `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<file.wav>` so the real app "hears" a file. Assert on the debug trace (`window.__debug`), not on sound.
4. **Real takes** recorded by Dylan (`fixtures/real/`). Ground truth comes from offline DTW alignment, not hand annotation.
5. **Dylan's live test** on the deployed site. Every milestone ends with a short "Dylan test" checklist in `docs/MILESTONES.md`; do not guess the results.

**The real Swan MIDI is not in the repo.** CI and fresh sessions won't have it. Therefore: (a) commit a tiny original `tests/fixtures/mini-score.mid` (a made-up melody + accompaniment generated by a script) so unit tests, e2e tests and CI run without the real file; (b) tests and `npm run eval` that need the real score use `local/swan.mid` and must **skip with a clear message** when it is absent (e.g. `describe.skipIf`), never fail; (c) generated fixtures derived from the real score go in gitignored `fixtures/synthetic/`; (d) at the start of any session that needs the real score, ask Dylan to attach `swan.mid` again and place it at `local/swan.mid`. Claims about the real piece (note counts, bar table, eval metrics) must say whether they were produced with the real score present.

## Working agreement

- Start each milestone in **plan mode**: propose the approach, list files to touch, state how it will be verified. Wait for approval.
- **Commit directly to `main`.** No PRs. Use a branch only for genuinely conflicting parallel work streams, and merge it back into `main` promptly. Small commits, descriptive messages; run all commands locally and keep them green before each push. CI is deliberately minimal (score-file guard, build, deploy); don't add test steps to it without asking.
- **Each milestone ends with an entry in `docs/MILESTONES.md`:** what changed, how it was verified, the "Dylan test" checklist, and anything left unverified (e.g. without a microphone). Also summarize it in chat.
- If something requires a decision or action from Dylan (accounts, settings, recordings, listening tests), say so explicitly at the top of the milestone entry and in chat instead of working around it.
- **Instructions for Dylan** (settings, accounts, anything he must click): always numbered, short, simple steps that assume no prior knowledge of GitHub or where anything is. Give a direct link to the exact page when one exists (e.g. `https://github.com/dylcai85/Swan-accompaniment/settings/pages`), then say exactly what to click, by its on-screen name. One action per step.
- **Long-running work:** run anything that may take over ~5 minutes in the background, and send Dylan a push notification when it finishes (or fails) if it ran longer than 5 minutes, or when blocked on his input while he may be away. No pings for quick or routine steps.
- Prefer boring and simple. If two designs work, choose the one with fewer moving parts.
- Keep this file under ~150 lines. Put detail in `docs/`.

## Glossary

- **Score follower:** causal algorithm estimating position in the cello part from live audio.
- **Rate:** performed speed relative to nominal (1.0 = nominal tempo).
- **Lock / lost:** follower confidence states. When lost, the piano keeps going at the last rate and does not jump.
- **Free-run:** piano plays on its own before the cello has entered (the opening bar).
