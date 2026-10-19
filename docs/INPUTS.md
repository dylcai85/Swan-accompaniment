# Inputs needed from Dylan

Things only Dylan can provide or do. Tick an item (`[x]`) when it's done; Claude updates this file in the milestone PR that consumes it.

## Accounts and settings

- [ ] **Enable GitHub Pages**: repo Settings → Pages → Build and deployment → Source: **GitHub Actions**. Free for this public repo. *Needed by M0.*
- [ ] **Give Claude push access to this repo**: install the Claude GitHub App on `dylcai85/swan-accompaniment` (https://github.com/apps/claude/installations/select_target), or reconnect GitHub at claude.ai → Settings → Connectors. Without it Claude can commit locally but cannot push branches or open PRs. *Needed by M0 (blocks the setup PR).*

## Files (local only unless stated)

- [x] **Swan MIDI** → `local/swan.mid` (gitignored). Provided in the setup session. **Re-attach it in every new cloud session that needs the real score.** *Needed by M1 (score:inspect, real-score tests), M4–M6 (synthetic fixtures, eval).*
- [ ] **Score PDF of the Swan (cello + piano)** → `local/swan-score.pdf` (gitignored, local only, never committed). *Needed by M1 (spot check of the cello table against the printed score).*
- [ ] **Decision: may your cello takes be committed?** This repo is public, so committed takes are public recordings. Yes → `fixtures/real/`; no → `local/takes/` (gitignored), re-attached when needed. *Needed by M4.*
- [ ] **Real cello takes**: cello only, no piano, same mic/position/room as live use, from the top of the Swan, FLAC preferred (<~5 MB each). Location: `fixtures/real/` or `local/takes/`, per the decision above. Conditions and naming: `fixtures/real/README.md`. *Needed by M4 (harness), M5 (follower gates).*
  - [ ] `01-steady-65bpm.flac`: steady, comfortable tempo (~65 bpm quarter)
  - [ ] `02-expressive.flac`: generous rubato, ritardandos at phrase ends
  - [ ] `03-slow-50bpm.flac`: slow, ~50 bpm
  - [ ] `04-mistake-bar8.flac`: wrong note around bar 8, stop for a bar, resume
  - [ ] `05a-room-noise-10s.flac`: 10 s of silence (room noise)
  - [ ] `05b-open-a-5s.flac`: open A string for 5 s (tuning check)

## Equipment and live tests

- [ ] **Wired headphones** ready for live tests (no Bluetooth: latency and mic degradation). *Needed from M2.*
- [ ] **Dylan test** at the end of each milestone (checklist in each PR). *Every milestone, starting M0.*
