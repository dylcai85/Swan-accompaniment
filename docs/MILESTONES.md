# Milestone log

One entry per milestone, newest first. Each entry: what changed, how it was verified, the Dylan test, and what is still unverified. Work is committed directly to `main`.

## M3: Mic input and pitch tracker (2026-10-19)

**Needs Dylan:** the cello test below (wired headphones, cello ready).

**Changed**
- `src/dsp/pitch.ts`: YIN pitch tracker in pure TS (cumulative mean normalized difference, threshold 0.15, parabolic interpolation, 55-1000 Hz, ~43 ms window at 48 kHz, preallocated buffers, early stop after the first dip). Unvoiced below -50 dBFS or confidence 0.5. Sample rate always from the AudioContext.
- `src/dsp/smooth.ts`: note name + cents (A4 = 440; the tuning offset comes in M5) and a 5-frame median so single stray frames don't show.
- `src/audio/capture.worklet.js` + `src/audio/mic.ts`: getUserMedia with echo cancellation, noise suppression and auto gain all off, mono; the worklet copies samples into one preallocated 1024-sample chunk and posts it (no allocation or logging in `process()`); the main thread keeps a sliding analysis window (~47 analyses/s). The mic is not connected to the speakers. The worklet is emitted as its own file and loaded via `new URL(..., import.meta.url)`.
- `src/ui/micPanel.ts`: Start/Stop mic, Microphone dropdown, level meter with "very quiet"/"clipping" hints, big note readout (e.g. "A3 +4¢"), frequency and confidence, latency line (output, base, analysis window, sample rate).
- `window.__debug.pitch`, `__debug.pitchLog` (last 200 readings), `__debug.workletUrl`.

**Dependencies:** none.

**Verified** (cloud sandbox, Chromium 141, no mic; synthetic audio only)
- Unit, at 44.1 and 48 kHz: sines 130-600 Hz in quarter-tone steps and the open strings C2/G2/D3/A3 (cello-like tone with a weak fundamental) all within 10 cents; 5.5 Hz vibrato of ±30 cents tracked within ±40 cents of the instantaneous pitch with the smoothed note name never changing; octave errors under 2% of frames on sawtooth and cello-like tones from 65 to 600 Hz; silence and -60 dBFS noise unvoiced.
- Speed (Node, 48 kHz, 60 s of audio): 14x real time on the open C (worst case), 41x at G3, 83x at A4. Live, that is roughly 2-7% of one CPU core.
- Fake-mic e2e (Chromium playing a generated WAV as the microphone): A3 and D4 recognized with steady readings within 15 cents (in practice 0-2 cents), silence reported as no pitch, level meter moving, worklet loaded from `/Swan-accompaniment/assets/capture.worklet-*.js` in the production build. Stable over repeated runs.
- All local commands green; without `local/swan.mid` the real-score tests skip.

**Unverified:** a real microphone and a real cello (bow noise, room, slides, how the browser and your mic handle the "processing off" settings). The first frame or two of a note can read slightly off while the window still contains the silence before it.

**Dylan test** (wired headphones, Chrome on a computer, cello ready)
- [ ] Open https://dylcai85.github.io/Swan-accompaniment/ and press Ctrl+Shift+R (Mac: Cmd+Shift+R).
- [ ] Click **Start mic**. When Chrome asks to use your microphone, click **Allow**.
- [ ] If you have more than one microphone, pick the right one in the **Microphone** dropdown.
- [ ] Play each open string (C, G, D, A) for a few seconds. Does the big note match, with no octave jumps?
- [ ] Play a slow scale with vibrato. Does it follow smoothly?
- [ ] Play a slow slide. Does it track without jumping around?
- [ ] Tell Claude the **Latency** line, and whether the green level bar sits in the middle without "Clipping".

## M2: Piano playback engine (2026-10-19)

**Needs Dylan:** the listening test below, with wired headphones.

**Changed**
- `src/playback/clock.ts`: score clock, `tick(t) = anchorTick + rate * ticksPerSec * (t - anchorTime)`. Ticks become seconds only here.
- `src/playback/scheduler.ts`: lookahead scheduler (120 ms window, pumped every 25 ms). Each piano note is handed to the voice exactly once, in order. **Design choice:** a rate change takes effect at the end of the window already handed off, so scheduled notes never move and there are no doubled or dropped notes; the cost is that a change is heard up to ~120 ms late.
- `src/playback/voices.ts`: Salamander piano via Tone.js `Sampler` with light reverb (Tone runs on our AudioContext; its Transport is not used), and a simple oscillator synth used in tests and as a fallback until or unless the samples load.
- `src/playback/player.ts` + `src/ui/transport.ts`: Play/Pause, Bar + Go, Speed slider 0.50–1.50× (live), Piano 2 on/off, status line with the current bar and which sound is in use. Footer credits Salamander (CC-BY 3.0).
- `window.__debug.playback` (state, tick, bar, rate, notes handed off, voice) and `__debug.renderOffline()` for tests.

**Dependency:** `tone` 15.1.22 (runtime): the Sampler and reverb for piano sound, as named in CLAUDE.md. Loaded only when you first press Play (separate 341 kB chunk; the page itself is 47 kB).

**Verified** (cloud sandbox, Chromium 141, no speakers; real score present unless noted)
- Unit tests: clock continuity across rate changes, seek, inverse mapping; scheduler note times at rate 1 and 0.5, every note handed off once and in order through several rate changes, new rate applies after the committed window, Piano 2 off, seek. Real score (present): all 1177 piano notes handed off exactly once with rate changes.
- Offline render in Chromium (`OfflineAudioContext`, mini score, piano 1, 10 s, rate 1.0 → 0.75 at 5 s): 47 onsets detected in the audio, all within 5 ms of the scheduled times (mean 2 ms); note spacing grows by 1/0.75 after the change.
- e2e UI flow: Play advances the position, the speed slider changes the rate live, Pause freezes the position, Go to bar 4 lands on bar 4 beat 1. The sample CDN is blocked in the sandbox, so the test also confirmed the synth fallback kicks in and the status says so.
- All local commands green; without `local/swan.mid` the 7 real-score unit tests skip.

**Follow-up fixes after Dylan's test:** (1) Pause sometimes needed several clicks on his machine. Not reproducible in headless Chromium (state and audio stop on the first click), so the two plausible causes were removed: concurrent clicks could create a second, unreachable player, and the button/status text was rewritten ~40x/s. (2) The first ~2 s played on the simple synth before the piano samples loaded; the first Play now waits for the samples ("Loading piano sound…").

**Unverified (no speakers here):** how the piano sounds, whether the Salamander samples load in your browser, and real-device timing or glitches while dragging the slider.

**Dylan test** (wired headphones, Chrome on a computer)
- [ ] Open https://dylcai85.github.io/Swan-accompaniment/ (load `swan.mid` if it says "No score loaded").
- [ ] Click **Play**. Within a few seconds the line under the controls should say "Piano ready". Listen for about 30 seconds: acceptable, or too dry / choppy / needs pedal or more reverb?
- [ ] While it plays, drag **Speed** slowly down to 0.60 and back up to 1.30. Smooth? Any skipped, doubled or stuck notes?
- [ ] Untick **Piano 2**, listen, tick it again. Which do you prefer?
- [ ] Click **Pause**. Type 14 in the **Bar** box, click **Go**, then **Play**. Does it start cleanly at bar 14?

## CI trimmed (2026-10-19)

At Dylan's request CI is now minimal: on pushes to `main` (docs-only changes skipped) it runs `npm ci`, `check:no-score`, `build`, `check:no-score` on dist, then deploys to Pages. Typecheck, unit tests, e2e, `score:inspect` and `eval` run locally before every push instead.

## M1: Score model (2026-10-19)

**Dylan test passed** (2026-10-19).

**Changed**
- `src/score/`: `parseScore()` turns a MIDI file into a `Score` in ticks. It reads the meter from the file, uses the median tempo as the nominal tempo (the tempo map is otherwise ignored), finds tracks by name with a fallback to track order, and clips cello legato overlaps so the line is monophonic. Also `tickToBarBeat`, `midiToName`, and a small IndexedDB cache.
- Page: **Load score** file picker and **Forget score** button. The file stays in the browser (cached in IndexedDB, never uploaded or bundled). The status line shows bars, meter, note counts and nominal tempo; bad files show an error and do not replace a cached score.
- `tests/fixtures/mini-score.mid`: an original, made-up 6-bar 3/4 score, generated by `npm run fixtures:mini` (`tools/mini-score.ts`). Tests and CI use it.
- `npm run score:inspect [file]` prints the header facts and a bar-by-bar table (terminal only; never saved in the repo).

**Dependency:** `@tonejs/midi` 2.0.28 (runtime): the MIDI parser/writer named in CLAUDE.md. Its Node build is UMD, so `src/score/midiLib.ts` resolves the export for both Vite and Node.

**Verified** (cloud sandbox, Chromium 141, no mic; real score present unless noted)
- All commands green. 21 unit tests pass with `local/swan.mid` present; without it, the 6 real-score tests are skipped and the other 15 pass (what CI runs).
- Real score (present): PPQ 256, 6/4, 1536 ticks/bar, 44 tempo events with median 67 bpm, 113 / 919 / 258 notes, cello first onset bar 2 beat 1, all cello onsets on the sixteenth grid, 60 overlaps clipped, 28 bars.
- e2e: loading the mini score through the file picker shows the right summary, survives a reload (IndexedDB), and Forget clears it; a non-MIDI file shows an error and keeps the cached score.
- `dist/` contains no `.mid` and no score data.

**Unverified:** that the MIDI's pitches match the printed score (your check); IndexedDB in browsers other than Chromium.

**Dylan test**
- [x] Compare the cello bars pasted in chat with your sheet music. Report any wrong note or octave.
- [x] Open https://dylcai85.github.io/Swan-accompaniment/ in Chrome on a computer.
- [x] Click **Choose file** next to "Load score" and pick your `swan.mid`.
- [x] The line under it should say: Score loaded: swan.mid · 28 bars · 6/4 · cello 113 · piano 1 919 · piano 2 258 · nominal 67 bpm.
- [x] Reload the page (F5). It should still say "Score loaded".
- [x] Click **Forget score**. It should say "No score loaded".

## M0: Scaffold and deploy (2026-10-19)

**Dylan test passed** (2026-10-19). Pages enabled.

**Changed**
- Vite 8 + strict TS, Vitest, Playwright, tsx, Node 22 (`.nvmrc`). Vite `base` = `/Swan-accompaniment/`.
- Page: headphones-required notice, Start button (creates/resumes an interactive `AudioContext` from the click; shows sample rate and base/output latency), build stamp (short SHA + UTC time).
- `npm run check:no-score`: fails if any `.mid/.midi/.mxl/.musicxml/.pdf` (except `tests/fixtures/mini-score.mid`) or anything under `local/` is in the git index, or any such file is in `dist/`.
- `score:inspect` and `eval` are stubs (exit 0; `score:inspect` prints SKIP when `local/swan.mid` is absent). Replaced in M1 and M4/M5.
- `.github/workflows/ci.yml`: full checks on every push (guard, typecheck, unit, build, guard on dist, e2e, score:inspect, eval); on `main`, deploys `dist/` to Pages.

**Dependencies** (devDependencies, exact pins, each ≥2 weeks old)
- `vite` 8.3.2: bundler/dev server.
- `typescript` 5.9.3: strict typecheck (mature 5.x line, not the 7.0 native rewrite).
- `vitest` 5.0.3: unit tests.
- `@playwright/test` 1.56.1: e2e; matches the Chromium preinstalled in cloud sessions.
- `tsx` 4.23.15: runs TS tools in Node.
- `@types/node` 22.20.5: types for tools/configs.
- npm 10.9 (bundled with Node 22) crashes resolving vitest's peer set (arborist `edgesOut` bug); the lockfile was written with npm 11.6.2 and `npm ci` with npm 10 installs it fine.

**Verified** (cloud sandbox, Chromium 141, no mic; real score present for score:inspect)
- All commands green: check:no-score, typecheck, test (2 unit tests), build, check:no-score on dist, test:e2e, score:inspect, eval.
- `dist/index.html` references only `/Swan-accompaniment/assets/...`. The e2e test serves the production build with `vite preview` under that path and asserts: notice, Start and build stamp visible; all assets under the base path; no 4xx; no console errors; Start reports "Audio ready · N Hz · base latency …".
- `score:inspect` with and without `local/swan.mid`: both exit 0, the latter with a clear SKIP message.
- Guard negative tests: a force-staged dummy `x.mid` and a dummy `dist/leak.pdf` each make `check:no-score` exit 1 (neither committed).
- CI green on GitHub Actions for the M0 commits.

**Unverified (no mic/speakers here):** real-device latency values; that the deployed site loads (Pages not enabled yet); browsers other than Chromium.

**Dylan test** (desktop Chrome, after Pages is enabled and the deploy job is green)
- [x] https://dylcai85.github.io/Swan-accompaniment/ loads and shows the headphones notice.
- [x] The footer build stamp matches the latest `main` commit's short SHA.
- [x] Click **Start**; report the sample rate and base/output latency, once with wired headphones plugged in and once without.

## Setup (2026-10-19)

- `.gitignore` (first commit, before anything else), `CLAUDE.md`, `docs/PLAN.md`, `README.md`, `docs/LOCAL_FILES.md`, `docs/INPUTS.md`, `fixtures/real/README.md`.
- PLAN.md facts checked against the real `local/swan.mid` (present): all stated facts match (type 1, 4 tracks, PPQ 256, 6/4 → 1536 ticks/bar, G major, 44 tempo events 50-70 bpm with median 67, cello 113 notes E3-D5 entering bar 2 beat 1 all on the 16th grid, piano 1 919 notes, piano 2 258 notes with 50 off-grid onsets, ~27 bars). Minor notes for M1: duration is 145.4 s (not ~148 s); the cello track has 60 legato overlaps of 2-15 ticks with no simultaneous onsets (clip them to keep the line monophonic); piano 1 has 1 off-grid onset.
