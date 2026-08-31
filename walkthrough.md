# Setu — Walkthrough

## What was built

A complete single-file prototype ([index.html](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/index.html)) for the **Setu H₂S Dosimeter Reader** — a companion phone app for passive H₂S dosimeter wristbands.

### Architecture

**Single file, zero dependencies** (besides Google Fonts CDN link). ~60KB total. No build step, no npm, no framework — per AGENT.md's "fastest-path-to-working-prototype" directive.

### 6 Views (all in-page, JS show/hide)

| View | Key Features |
|---|---|
| **Welcome** | Worker ID input, shift selector, last-reading summary card |
| **Camera** | Rear-facing `getUserMedia` viewfinder with badge alignment guide |
| **Tap-to-Calibrate** | 3-step tap flow (white ref → exposure strip → expiry patch) with visual markers |
| **Processing** | Animated step-by-step progress (white balance → dose → expiry) |
| **Results** | Dose range display, risk bar, badge validity, color swatches |
| **History** | Saved readings list with risk indicators, CSV export |

### Core Modules (pure functions)

| Module | Functions |
|---|---|
| **Colorimetry** | `srgbToLinear`, `linearToSrgb`, `applyWhiteBalance`, `fitChannel`, `estimateDose`, `checkExpiry` |
| **Camera** | `startCamera`, `stopCamera`, `captureFrame`, `sampleRegion` |
| **Storage** | `getReadings`, `saveReading`, `exportCSV` |

### Domain Constraints Honored

- ✅ **Dose always a range** — `estimateDose()` returns `{low, high}`, UI shows "X – Y ppm·h"
- ✅ **Placeholder warning** — non-dismissible amber banner fixed at top of every view
- ✅ **No localStorage** — uses `window.storage` shim with in-memory fallback
- ✅ **Pure colorimetry** — zero UI/storage deps in color math functions
- ✅ **No ML/CNN** — piecewise-linear interpolation only
- ✅ **No cloud/backend** — fully client-side
- ✅ **No auto-detection** — manual tap-to-calibrate

### Design System

- Dark-themed with glassmorphism cards and subtle noise texture
- Token-accurate colors: ink, paper, amber, safe, danger
- Fonts: Space Grotesk / Inter / IBM Plex Mono
- Micro-animations: view transitions, tap marker spring animation, chip pulses, spinner
- Mobile-first, capped at 420px on larger screens

## How to verify

1. Open [index.html](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/index.html) in Chrome/Edge on a device with a camera
2. Enter any Worker ID → "Start Capture" enables
3. Grant camera permission → live viewfinder with alignment guide
4. Capture photo → tap 3 regions → watch processing animation → see dose range result
5. Save reading → check history → export CSV
