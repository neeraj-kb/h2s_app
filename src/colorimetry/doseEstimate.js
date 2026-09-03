/**
 * Cumulative Dose Estimation Module
 * Pure functions — zero UI or storage dependencies.
 */

/**
 * Placeholder calibration table. Each entry maps a cumulative dose
 * (ppm·h) to the expected RGB of the exposure strip under ideal
 * (white-balanced) lighting. These are NOT real lab values.
 */
export const DEFAULT_CALIBRATION = [
  { ppmH: 0, rgb: [245, 240, 230] },
  { ppmH: 2, rgb: [220, 210, 180] },
  { ppmH: 5, rgb: [190, 170, 140] },
  { ppmH: 10, rgb: [160, 130, 100] },
  { ppmH: 20, rgb: [120, 90, 70] },
  { ppmH: 50, rgb: [80, 55, 40] },
];

/**
 * Piecewise-linear interpolation of a single value against a sorted
 * array of { x, y } calibration points.
 *
 * @param {number} value
 * @param {Array<{x: number, y: number}>} points
 * @returns {number}
 */
export function fitChannel(value, points) {
  if (value <= points[0].x) return points[0].y;
  if (value >= points[points.length - 1].x) return points[points.length - 1].y;
  for (let i = 0; i < points.length - 1; i++) {
    if (value >= points[i].x && value <= points[i + 1].x) {
      const t = (value - points[i].x) / (points[i + 1].x - points[i].x);
      return points[i].y + t * (points[i + 1].y - points[i].y);
    }
  }
  return points[points.length - 1].y;
}

/**
 * Estimate cumulative H₂S dose from a white-balanced strip RGB.
 * Returns a { low, high, unit } range — NEVER a single number.
 *
 * Method: compute Euclidean distance in RGB space from each calibration
 * entry, pick the two closest, linearly interpolate to get a centre
 * estimate, then widen to a ± range that represents measurement
 * uncertainty (hardcoded ±25 % for now, clamped ≥ 0.5 ppm·h).
 *
 * @param {[number, number, number]} correctedRGB
 * @param {Array<{ppmH: number, rgb: [number, number, number]}>} [calibrationTable]
 * @returns {{ low: number, high: number, unit: string }}
 */
export function estimateDose(correctedRGB, calibrationTable) {
  const cal = calibrationTable || DEFAULT_CALIBRATION;

  // Compute distance from each calibration point
  const dists = cal.map((entry, idx) => {
    const d = Math.sqrt(
      Math.pow(correctedRGB[0] - entry.rgb[0], 2) +
      Math.pow(correctedRGB[1] - entry.rgb[1], 2) +
      Math.pow(correctedRGB[2] - entry.rgb[2], 2)
    );
    return { idx, d, ppmH: entry.ppmH };
  });

  dists.sort((a, b) => a.d - b.d);
  const nearest = dists[0];
  const second = dists[1];

  // Weighted average of two nearest
  const totalDist = nearest.d + second.d || 1;
  const centre = nearest.ppmH * (1 - nearest.d / totalDist)
    + second.ppmH * (1 - second.d / totalDist);

  // ± 25 % uncertainty (clamped ≥ 0.5 ppm·h)
  const margin = Math.max(0.5, centre * 0.25);
  const low = Math.max(0, centre - margin);
  const high = centre + margin;

  return {
    low: Math.round(low * 10) / 10,
    high: Math.round(high * 10) / 10,
    unit: 'ppm·h',
  };
}
