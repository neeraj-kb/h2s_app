/**
 * Color Correction & White Balance Module
 * Pure functions — zero UI or storage dependencies.
 */

/**
 * sRGB channel (0-255) → linear space (remove gamma compression).
 * @param {number} c
 * @returns {number}
 */
export function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Linear space → sRGB channel (0-255) (apply gamma compression).
 * @param {number} c
 * @returns {number}
 */
export function linearToSrgb(c) {
  c = Math.max(0, Math.min(1, c));
  return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
}

/**
 * White-balance correction: scale the sampled pixel so that the
 * reference white patch maps to [255, 255, 255].
 * Operates in linear space to avoid gamma-compression artifacts.
 *
 * @param {[number, number, number]} pixelRGB - [R, G, B] 0-255
 * @param {[number, number, number]} refWhiteRGB - [R, G, B] 0-255
 * @returns {[number, number, number]} Corrected [R, G, B] 0-255
 */
export function applyWhiteBalance(pixelRGB, refWhiteRGB) {
  const linPixel = pixelRGB.map(srgbToLinear);
  const linRef = refWhiteRGB.map(srgbToLinear);
  return [
    linearToSrgb(linPixel[0] / (linRef[0] || 0.001)),
    linearToSrgb(linPixel[1] / (linRef[1] || 0.001)),
    linearToSrgb(linPixel[2] / (linRef[2] || 0.001)),
  ];
}
