# Stage 2 Walkthrough: Vite PWA Scaffold & Modular Architecture

## Summary of Accomplishments

Stage 2 has been instantiated following the planned architecture in [AGENT.md](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/AGENT.md). The application has transitioned from a single-file prototype into a modern, modular Progressive Web App (PWA) with offline capabilities, IndexedDB persistence, and an automated unit test suite.

---

## What Was Built

### 1. Preserved Single-File Prototype
- The original single-file prototype was backed up to [index.singlefile.html](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/index.singlefile.html). It remains runnable standalone in any browser with zero installation.

### 2. Project & Build Infrastructure
- [package.json](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/package.json): Added npm scripts:
  - `npm run dev`: Starts local Vite dev server
  - `npm run build`: Bundles production assets into `dist/`
  - `npm run preview`: Previews the production build
  - `npm run test`: Runs the Vitest test suite
- [vite.config.js](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/vite.config.js): Configured Vite bundler and Vitest test runner.
- [.gitignore](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/.gitignore): Excludes `node_modules/` and `dist/`.

### 3. Modular Code Architecture (`src/`)

```
src/
├── main.js                             # Application entry point & lifecycle
├── capture/
│   ├── camera.js                       # getUserMedia and canvas capture
│   └── tapCalibration.js               # Canvas coordinate mapping & circular pixel sampling
├── colorimetry/
│   ├── colorCorrection.js              # sRGB <-> linear conversion & white balance
│   ├── doseEstimate.js                 # Dose estimation (strictly enforces range output)
│   └── expiryCheck.js                  # Euclidean color distance badge validity check
├── storage/
│   ├── db.js                           # idb-backed IndexedDB with auto-migration
│   └── csvExport.js                    # CSV export for readings and lab experiments
├── ui/
│   ├── views.js                        # View controller, DOM binding, and animations
│   └── components/
│       └── experimentsChart.js         # Canvas rendering for lab calibration curves
├── styles/
│   ├── tokens.css                      # Design system tokens (--ink, --paper, --amber, etc.)
│   └── app.css                         # UI styling, responsive layout, cards, HUD
└── sw.js                               # Service Worker reference module
```

### 4. Storage & Persistence
- [src/storage/db.js](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/src/storage/db.js): Replaced `window.storage` shim with a robust IndexedDB layer (`setu_db`) using `idb`. Includes two stores:
  - `readings`: Worker field logs
  - `experiments`: Lab calibration runs
- **Automatic Migration**: Automatically checks for existing `localStorage` prototype data (`setu_readings`, `setu_experiments`) on startup and imports it into IndexedDB.

### 5. PWA & Offline Support
- [public/manifest.webmanifest](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/public/manifest.webmanifest): Configures standalone PWA installation on mobile devices.
- [public/sw.js](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/public/sw.js): Implements offline caching for app shell and assets for use in remote industrial field conditions without connectivity.

---

## Validation & Test Results

### 1. Automated Unit Tests (`tests/colorimetry.test.js`)
Ran `npm.cmd test` using Vitest:
- **10 of 10 tests passed (100%)**
- Validated:
  - `srgbToLinear` and `linearToSrgb` roundtrip and boundary values
  - `applyWhiteBalance` normalizes colors accurately against reference white
  - `fitChannel` piecewise interpolation at boundary conditions
  - **Critical Safety Constraint**: `estimateDose` ALWAYS returns a range `{ low, high, unit: 'ppm·h' }` where `low < high`, and never a single scalar number
  - Minimum uncertainty margin of at least 0.5 ppm·h
  - `checkExpiry` detects fresh and expired badges with confidence bounded between 0 and 1

### 2. Production Build (`npm.cmd run build`)
```
✓ 15 modules transformed.
dist/index.html                 13.06 kB │ gzip: 3.27 kB
dist/assets/index-MeUiiCvE.css  16.58 kB │ gzip: 4.22 kB
dist/assets/index-BGw78Oij.js   21.23 kB │ gzip: 7.70 kB
✓ built in 2.43s
```

### 3. Server Preview & Health Check
Tested `npm.cmd run preview` on port 4173:
- Responded with HTTP 200 OK and properly served the modular web application.
