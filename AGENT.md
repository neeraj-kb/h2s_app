# AGENT.md

Instructions for any coding agent (Claude Code, Cursor, Antigravity, etc.) working in this
repository. Read this before making changes. See also `INSTRUCTION.md` for deeper domain/product
context on the H2S dosimeter reader itself — this file is the operational quick-reference.

## Project

**Setu** — companion phone app for an indigenous, passive H2S dosimeter wristband (oil & gas
worker safety). Photographs a colorimetric exposure strip + printed reference scale + expiry
patch, corrects for ambient lighting, estimates cumulative H2S dose as a range, checks badge
validity, and logs readings by worker ID/shift for DGMS/OISD-style reporting.

## Current state

Single-file prototype: `index.html` (HTML + CSS + vanilla JS, no build step, no dependencies
besides a Google Fonts `<link>`). No backend. No test suite yet. No package.json yet.

Target architecture (not yet scaffolded — see "Planned structure" below): a Vite-built PWA with
IndexedDB persistence and a service worker for offline field use. Do not assume this structure
exists in the repo until it's actually been scaffolded — check the current file tree first.

## Setup / build / test commands

**Right now (single-file stage):** no setup needed. Open `index.html` directly in a browser with
camera permissions. No install, no build, no test command exists yet.

**Once scaffolded to Vite (see Stage 2 in prior discussion):**
```
npm install
npm run dev        # local dev server
npm run build       # production build
npm run test        # unit tests (colorimetry math)
npm run preview     # preview production build
```
If these scripts don't exist yet in `package.json`, don't assume them — check `package.json`
first, and if a task requires them, set them up as part of the task rather than guessing they're
already there.

## Code conventions

- No framework unless a task explicitly requires one. Vanilla JS/Preact preferred over React
  unless the user says otherwise — this app doesn't need what a heavy framework buys you.
- No `localStorage`/`sessionStorage`. Persistence goes through `window.storage` in the current
  prototype context, or IndexedDB (via `idb` or similar) once deployed as a standalone PWA.
- Keep colorimetry logic (`fitChannel`, dose interpolation, expiry color-distance check) as pure
  functions with no UI or storage dependencies — they're the most safety-critical code in the app
  and the easiest to unit test in isolation.
- Design tokens already established — reuse them, don't introduce new ones without reason:
  - Colors: ink `#171A19`, paper `#F2EFE6`, amber `#D69A2D` / amber-deep `#9C6A14`, safe `#3F6E5C`,
    danger `#B0402F`.
  - Type: `Space Grotesk` (display), `Inter` (body/UI), `IBM Plex Mono` (data readouts/status).
- Every dose value shown to a user must be a **range**, never a single precise number. This is a
  stated safety/honesty requirement from the product brief, not a formatting preference — do not
  simplify it away for cleaner UI.

## Domain rules that constrain implementation (do not silently override)

- The calibration table (`DEFAULT_CALIBRATION` in `index.html`) and the expiry-patch fresh/expired
  RGB anchors are **placeholder values**, not real lab data. Never treat them as ground truth in
  code or tests; keep the placeholder-data warning visible in the UI.
- No CNN, no image classifier, no ML training pipeline for this phase — there isn't enough labeled
  photo data to make one reliable, and it conflicts with the project's low-cost/no-electronics/
  fastest-to-demo constraints. If a future task adds a KNN-based color→dose lookup (a reasonable
  upgrade once more real calibration points exist), keep it as a swappable alternative to the
  existing piecewise-linear interpolation, not a replacement that removes the simpler path.
- Auto-detection of strip/scale/patch location in the photo (replacing manual tap-to-calibrate) is
  a deferred nice-to-have, not a current requirement. If pursued later, classical CV (fiducial
  markers + color thresholding) is preferred over a trained detector for the same reasons above.
- No cloud sync, no multi-device sync, no server backend unless a task explicitly asks for one —
  the app is local-device-only by design at this phase.

## Planned structure (Stage 2 — scaffold on request, don't assume it exists)

```
src/
├── main.js
├── capture/          # camera.js, tapCalibration.js
├── colorimetry/       # colorCorrection.js, doseEstimate.js, expiryCheck.js — pure functions
├── storage/           # db.js (IndexedDB), csvExport.js
├── ui/                 # views/, components/
├── styles/tokens.css
└── sw.js               # service worker
```

## Before submitting changes

- If you touch `colorimetry/` logic, add or update a unit test alongside it.
- If you touch dose-display UI, verify the range format is preserved (never a bare number).
- Don't add a build step, framework, or dependency the task doesn't need — this project's stated
  priority is fastest-path-to-working-prototype over completeness or polish.
- If a request seems to expand scope beyond this prototype phase (production hardening, cloud
  backend, ML models), flag that to the user rather than building it silently.