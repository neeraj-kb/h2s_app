/**
 * Expiry Patch Verification Module
 * Pure functions — zero UI or storage dependencies.
 */

/** Placeholder expiry-patch color anchors */
export const EXPIRY_ANCHORS = {
  fresh: [120, 180, 90],   // greenish
  expired: [180, 100, 80], // brownish
};

export const EXPIRY_THRESHOLD = 80; // Euclidean distance in RGB space

/**
 * Check whether the expiry patch indicates the badge is still valid.
 * Compares Euclidean distance to the "fresh" and "expired" RGB anchors.
 *
 * @param {[number, number, number]} patchRGB
 * @param {[number, number, number]} [freshAnchor]
 * @param {[number, number, number]} [expiredAnchor]
 * @param {number} [threshold]
 * @returns {{ valid: boolean, confidence: number, distFresh: number, distExpired: number }}
 */
export function checkExpiry(patchRGB, freshAnchor, expiredAnchor, threshold) {
  freshAnchor = freshAnchor || EXPIRY_ANCHORS.fresh;
  expiredAnchor = expiredAnchor || EXPIRY_ANCHORS.expired;
  threshold = threshold || EXPIRY_THRESHOLD;

  const distFresh = Math.sqrt(
    Math.pow(patchRGB[0] - freshAnchor[0], 2) +
    Math.pow(patchRGB[1] - freshAnchor[1], 2) +
    Math.pow(patchRGB[2] - freshAnchor[2], 2)
  );
  const distExpired = Math.sqrt(
    Math.pow(patchRGB[0] - expiredAnchor[0], 2) +
    Math.pow(patchRGB[1] - expiredAnchor[1], 2) +
    Math.pow(patchRGB[2] - expiredAnchor[2], 2)
  );

  const valid = distFresh < distExpired;
  const confidence = Math.min(1, Math.abs(distFresh - distExpired) / threshold);

  return {
    valid,
    confidence: Math.round(confidence * 100) / 100,
    distFresh,
    distExpired,
  };
}
