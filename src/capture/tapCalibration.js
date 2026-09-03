/**
 * Tap Calibration Module
 * Handles viewport-to-canvas coordinate mapping and circular pixel region sampling.
 */

/**
 * Average RGB in a circular region around (cx, cy) with given radius.
 * Coordinates are in canvas pixel space.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {[number, number, number]} Averaged [R, G, B]
 */
export function sampleRegion(canvas, cx, cy, radius) {
  const ctx = canvas.getContext('2d');
  radius = Math.round(radius);
  const x0 = Math.max(0, Math.round(cx) - radius);
  const y0 = Math.max(0, Math.round(cy) - radius);
  const w = Math.min(canvas.width - x0, radius * 2);
  const h = Math.min(canvas.height - y0, radius * 2);

  if (w <= 0 || h <= 0) return [128, 128, 128];

  const imgData = ctx.getImageData(x0, y0, w, h);
  const data = imgData.data;

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = px - radius;
      const dy = py - radius;
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (py * w + px) * 4;
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count++;
      }
    }
  }

  if (count === 0) return [128, 128, 128];
  return [
    Math.round(rSum / count),
    Math.round(gSum / count),
    Math.round(bSum / count),
  ];
}

/**
 * Map tap/click coordinates from DOM viewport to canvas pixel space,
 * taking object-fit: contain letterboxing/pillarboxing into account.
 *
 * @param {MouseEvent|TouchEvent} e
 * @param {HTMLCanvasElement} canvas
 * @returns {{ canvasX: number, canvasY: number, domX: number, domY: number }}
 */
export function domToCanvas(e, canvas) {
  const rect = canvas.getBoundingClientRect();

  // object-fit: contain — find actual image area
  const imgAspect = canvas.width / canvas.height;
  const boxAspect = rect.width / rect.height;

  let offsetX = 0, offsetY = 0, renderW = rect.width, renderH = rect.height;
  if (imgAspect > boxAspect) {
    // image is wider — letterbox top/bottom
    renderH = rect.width / imgAspect;
    offsetY = (rect.height - renderH) / 2;
  } else {
    // image is taller — pillarbox left/right
    renderW = rect.height * imgAspect;
    offsetX = (rect.width - renderW) / 2;
  }

  const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

  const domX = clientX - rect.left - offsetX;
  const domY = clientY - rect.top - offsetY;

  const canvasX = (domX / renderW) * canvas.width;
  const canvasY = (domY / renderH) * canvas.height;

  return {
    canvasX: Math.round(canvasX),
    canvasY: Math.round(canvasY),
    domX: clientX - rect.left,
    domY: clientY - rect.top,
  };
}
