# Setu — H₂S Dosimeter Reader Prototype (`index.html`)

Build the single-file prototype described in [AGENT.md](file:///c:/Users/Neeraj/OneDrive/Desktop/H2s_app/h2s_app/AGENT.md). One `index.html` file containing all HTML, CSS, and vanilla JS. No build step, no dependencies beyond a Google Fonts `<link>`.

## User Review Required

> [!IMPORTANT]
> **No Node.js detected on this machine.** The AGENT.md specifies "single-file stage" first — `index.html` opened directly in a browser. This plan builds exactly that. The Vite/PWA scaffold (Stage 2) is deferred per the spec.

> [!WARNING]
> **Calibration data is placeholder.** The UI will prominently display a warning banner that the calibration table and expiry-patch anchors are not from real lab data, per the domain rules.

## Open Questions

1. **Worker ID format** — The spec says "logs readings by worker ID/shift." Should worker IDs follow a specific pattern (e.g., alphanumeric, badge number), or is free-text acceptable for the prototype?
2. **Shift definition** — Are shifts just named labels (Morning/Afternoon/Night), or do they need start/end times?
3. **Camera preference** — Should the app default to the rear-facing camera (environment), which is typical for photographing a badge?

## Proposed Changes

### [NEW] `index.html` — Single-file prototype

A self-contained ~1200-line file with embedded `<style>` and `<script>` blocks implementing the full prototype:

---

#### 1. Design System (CSS)

| Token | Value |
|---|---|
| `--ink` | `#171A19` |
| `--paper` | `#F2EFE6` |
| `--amber` | `#D69A2D` |
| `--amber-deep` | `#9C6A14` |
| `--safe` | `#3F6E5C` |
| `--danger` | `#B0402F` |
| Fonts | Space Grotesk (display), Inter (body/UI), IBM Plex Mono (data readouts) |

- Dark-toned UI with warm accents — professional safety-tool aesthetic
- Glassmorphism panels for result cards
- Smooth micro-animations on state transitions (capture → processing → result)
- Mobile-first responsive layout (this will primarily run on phones)

---

#### 2. Application Screens / Views (all in one page, shown/hidden via JS)

| View | Purpose |
|---|---|
| **Welcome / Worker Setup** | Enter Worker ID, select shift, see last reading summary |
| **Camera Capture** | Live `getUserMedia` viewfinder (rear camera), capture button, overlay guide showing where to position the badge |
| **Tap-to-Calibrate** | After capture, user taps 3 regions: (1) white reference on printed scale, (2) exposure strip, (3) expiry patch. Visual guides with numbered markers |
| **Processing** | Animated progress — color correction, dose interpolation, expiry check |
| **Results** | Dose range display (e.g., "4–8 ppm·h"), badge validity status, color-coded risk indicator, save/export controls |
| **History** | List of past readings stored in `window.storage` (prototype) with CSV export button |

---

#### 3. Core Logic (JS — pure functions)

**Colorimetry Module:**
- `srgbToLinear(c)` / `linearToSrgb(c)` — gamma correction
- `applyWhiteBalance(pixelRGB, refWhiteRGB)` — normalize sampled color against the printed white reference
- `fitChannel(value, calibrationPoints)` — piecewise-linear interpolation of a single color channel against the calibration table
- `estimateDose(correctedRGB, calibrationTable)` → `{ low, high, unit: "ppm·h" }` — always returns a **range**, never a single number
- `checkExpiry(patchRGB, freshAnchorRGB, expiredAnchorRGB, threshold)` → `{ valid: boolean, confidence: number }` — Euclidean color distance

**Calibration Data (placeholder):**
```js
const DEFAULT_CALIBRATION = [
  { ppmH: 0,  rgb: [245, 240, 230] },  // unexposed
  { ppmH: 2,  rgb: [220, 210, 180] },
  { ppmH: 5,  rgb: [190, 170, 140] },
  { ppmH: 10, rgb: [160, 130, 100] },
  { ppmH: 20, rgb: [120, 90,  70]  },
  { ppmH: 50, rgb: [80,  55,  40]  },
];
```

**Camera Module:**
- `startCamera(videoEl, facingMode)` — request rear camera with constraints
- `captureFrame(videoEl, canvasEl)` — grab current frame to canvas
- `sampleRegion(canvas, x, y, radius)` — average RGB in a circular region around a tap point

**Storage Module:**
- `saveReading(data)` — persist to `window.storage` (prototype shim)
- `getReadings()` — retrieve all past readings
- `exportCSV(readings)` — generate and download a CSV file

---

#### 4. UI Interactions

- **Tap-to-calibrate flow:** After photo capture, canvas overlay with 3 numbered circles. User taps each in order. Each tap samples a region of pixels and averages the RGB. Visual feedback (circle fills with the sampled color).
- **Risk indicator:** Color-coded bar that maps the dose range to safe/caution/danger zones based on OSHA-aligned thresholds (placeholder).
- **Placeholder data warning:** Persistent amber banner at top: *"⚠ Calibration data is placeholder — not from lab measurements. Do not use for real safety decisions."*
- **Dose always shown as a range:** e.g., "Estimated exposure: **4 – 8 ppm·h**", never a single value.

---

#### 5. Key Constraints Honored

| Constraint (from AGENT.md) | How honored |
|---|---|
| No framework | Vanilla JS, zero npm dependencies |
| No localStorage/sessionStorage | Uses `window.storage` shim |
| Dose as range | `estimateDose()` returns `{low, high}`, UI enforces range display |
| Placeholder warning | Persistent banner, cannot be dismissed |
| No ML/CNN | Piecewise-linear interpolation only |
| No cloud/backend | Fully client-side |
| No auto-detection | Manual tap-to-calibrate |
| Pure colorimetry functions | No UI or storage dependencies in color math |

## Verification Plan

### Manual Verification
- Open `index.html` in Chrome/Edge with camera permissions
- Walk through the full flow: enter worker ID → capture photo → tap 3 calibration points → view dose range result → check history → export CSV
- Verify placeholder warning banner is visible on every screen
- Verify dose is always shown as a range
- Test on mobile viewport (responsive layout)
- Verify camera defaults to rear-facing
