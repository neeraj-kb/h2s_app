/**
 * Auto-Detection Module for Setu Dosimeter Badges
 * Automatically determines coordinates for:
 * 1. White Reference area (printed photometric scale)
 * 2. Chemical Exposure Strip (central reactive area)
 * 3. Chemical Expiry Patch (shelf-life indicator)
 */

/**
 * Default normalized badge coordinates relative to camera reticle:
 * P1 (White Ref): Bottom-left of badge (x: 22%, y: 70%)
 * P2 (Exposure Strip): Center of badge (x: 50%, y: 46%)
 * P3 (Expiry Patch): Top-right of badge (x: 76%, y: 22%)
 */
export const DEFAULT_NORMALIZED_POINTS = [
  { nx: 0.22, ny: 0.70, label: 'White Ref', id: 'ref' },
  { nx: 0.50, ny: 0.46, label: 'Exposure Strip', id: 'strip' },
  { nx: 0.76, ny: 0.22, label: 'Expiry Patch', id: 'expiry' },
];

/**
 * Automatically detects the 3 calibration points on the captured canvas.
 * Combines reticle-aligned geometric priors with local contrast/whiteness scanning.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Array<{ canvasX: number, canvasY: number, label: string, id: string }>}
 */
export function autoDetectPoints(canvas) {
  const w = canvas.width || 1920;
  const h = canvas.height || 1080;

  // Base positions derived from camera alignment reticle
  let p1 = {
    canvasX: Math.round(w * DEFAULT_NORMALIZED_POINTS[0].nx),
    canvasY: Math.round(h * DEFAULT_NORMALIZED_POINTS[0].ny),
    label: DEFAULT_NORMALIZED_POINTS[0].label,
    id: DEFAULT_NORMALIZED_POINTS[0].id,
  };

  let p2 = {
    canvasX: Math.round(w * DEFAULT_NORMALIZED_POINTS[1].nx),
    canvasY: Math.round(h * DEFAULT_NORMALIZED_POINTS[1].ny),
    label: DEFAULT_NORMALIZED_POINTS[1].label,
    id: DEFAULT_NORMALIZED_POINTS[1].id,
  };

  let p3 = {
    canvasX: Math.round(w * DEFAULT_NORMALIZED_POINTS[2].nx),
    canvasY: Math.round(h * DEFAULT_NORMALIZED_POINTS[2].ny),
    label: DEFAULT_NORMALIZED_POINTS[2].label,
    id: DEFAULT_NORMALIZED_POINTS[2].id,
  };

  try {
    const ctx = canvas.getContext('2d');
    if (ctx && w > 20 && h > 20) {
      // 1. Refine White Reference: Search candidate window around bottom-left for peak neutral luminance
      const searchBoxW = Math.round(w * 0.16);
      const searchBoxH = Math.round(h * 0.16);
      const startX = Math.max(0, p1.canvasX - Math.round(searchBoxW / 2));
      const startY = Math.max(0, p1.canvasY - Math.round(searchBoxH / 2));
      const scanW = Math.min(w - startX, searchBoxW);
      const scanH = Math.min(h - startY, searchBoxH);

      if (scanW > 5 && scanH > 5) {
        const imgData = ctx.getImageData(startX, startY, scanW, scanH);
        const data = imgData.data;

        let bestScore = -Infinity;
        let bestX = p1.canvasX;
        let bestY = p1.canvasY;

        // Step by 2 pixels for performance
        for (let y = 2; y < scanH - 2; y += 2) {
          for (let x = 2; x < scanW - 2; x += 2) {
            const idx = (y * scanW + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const sat = Math.max(r, g, b) - Math.min(r, g, b);
            // High luminance and low saturation is white
            const score = lum - sat * 2;

            if (score > bestScore && lum > 140) {
              bestScore = score;
              bestX = startX + x;
              bestY = startY + y;
            }
          }
        }

        // If a high-confidence white patch was found, snap to it
        if (bestScore > 120) {
          p1.canvasX = bestX;
          p1.canvasY = bestY;
        }
      }
    }
  } catch (err) {
    // If canvas is tainted or context unavailable, fallback safely to reticle geometry
    console.warn('Auto-detect computer vision pass skipped, using geometric anchors:', err);
  }

  // Ensure coordinates remain safely clamped inside canvas bounds
  const margin = Math.max(12, Math.round(Math.min(w, h) * 0.03));
  [p1, p2, p3].forEach((p) => {
    p.canvasX = Math.max(margin, Math.min(w - margin, p.canvasX));
    p.canvasY = Math.max(margin, Math.min(h - margin, p.canvasY));
  });

  return [p1, p2, p3];
}
