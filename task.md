# Setu — Build Tasks

## Stage 1: Single-File Prototype
- [x] Design system CSS (tokens, fonts, base styles, animations)
- [x] HTML structure (all 6 views + experiments dashboard)
- [x] Core colorimetry pure functions
- [x] Camera module (getUserMedia, capture, sample)
- [x] Tap-to-calibrate interaction
- [x] Processing & results view (range enforcement)
- [x] Storage module & history view
- [x] CSV export
- [x] Placeholder warning banner
- [x] Responsive polish & micro-animations

## Stage 2: Vite PWA Modular Architecture (Completed)
- [x] Back up single-file prototype to `index.singlefile.html`
- [x] Project scaffold: `package.json`, `vite.config.js`, `.gitignore`
- [x] Style modules: `src/styles/tokens.css`, `src/styles/app.css`
- [x] Pure colorimetry modules: `src/colorimetry/colorCorrection.js`, `src/colorimetry/doseEstimate.js`, `src/colorimetry/expiryCheck.js`
- [x] Camera & capture modules: `src/capture/camera.js`, `src/capture/tapCalibration.js`
- [x] IndexedDB storage layer with auto-migration from localStorage: `src/storage/db.js`
- [x] CSV export utilities: `src/storage/csvExport.js`
- [x] UI controller & chart components: `src/ui/views.js`, `src/ui/components/experimentsChart.js`
- [x] PWA assets & offline caching: `public/manifest.webmanifest`, `public/sw.js`
- [x] Modular main entry point: `src/main.js` and updated `index.html`
- [x] Vitest automated test suite: `tests/colorimetry.test.js` (10/10 passing)
- [x] Production build validation (`npm run build` succeeds)
