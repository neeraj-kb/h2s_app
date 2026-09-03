import { describe, it, expect } from 'vitest';
import { srgbToLinear, linearToSrgb, applyWhiteBalance } from '../src/colorimetry/colorCorrection.js';
import { estimateDose, fitChannel, DEFAULT_CALIBRATION } from '../src/colorimetry/doseEstimate.js';
import { checkExpiry, EXPIRY_ANCHORS } from '../src/colorimetry/expiryCheck.js';

describe('Color Correction Module', () => {
  it('converts sRGB 0 to 0 and 255 to 1 in linear space', () => {
    expect(srgbToLinear(0)).toBeCloseTo(0, 4);
    expect(srgbToLinear(255)).toBeCloseTo(1, 4);
  });

  it('roundtrips sRGB -> Linear -> sRGB across multiple color intensities', () => {
    const testValues = [0, 16, 64, 128, 192, 240, 255];
    for (const val of testValues) {
      const lin = srgbToLinear(val);
      const roundtrip = linearToSrgb(lin);
      expect(roundtrip).toBe(val);
    }
  });

  it('applies white balance correctly against pure white and off-white references', () => {
    // When white reference is already 255, pixel remains unchanged
    const corrected1 = applyWhiteBalance([150, 120, 90], [255, 255, 255]);
    expect(corrected1).toEqual([150, 120, 90]);

    // When white reference has a yellow cast (e.g. [240, 240, 200]), blue is boosted
    const corrected2 = applyWhiteBalance([100, 100, 100], [240, 240, 200]);
    expect(corrected2[2]).toBeGreaterThan(corrected2[0]);
  });
});

describe('Dose Estimation Module (Safety Rules)', () => {
  it('fitChannel performs piecewise interpolation between points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 50 },
      { x: 20, y: 100 },
    ];
    expect(fitChannel(0, points)).toBe(0);
    expect(fitChannel(5, points)).toBe(25);
    expect(fitChannel(10, points)).toBe(50);
    expect(fitChannel(15, points)).toBe(75);
    expect(fitChannel(25, points)).toBe(100);
  });

  it('CRITICAL SAFETY RULE: estimateDose ALWAYS returns a range { low, high, unit }, NEVER a single number', () => {
    const unexposedRGB = [245, 240, 230];
    const res = estimateDose(unexposedRGB, DEFAULT_CALIBRATION);

    // Must be an object with low, high, unit
    expect(res).toHaveProperty('low');
    expect(res).toHaveProperty('high');
    expect(res).toHaveProperty('unit', 'ppm·h');

    // Never a single scalar
    expect(typeof res.low).toBe('number');
    expect(typeof res.high).toBe('number');
    expect(res.low).toBeLessThanOrEqual(res.high);
    expect(res.low).toBeGreaterThanOrEqual(0);
  });

  it('estimates lower dose for unexposed badge and higher dose for darkened badge', () => {
    const unexposed = estimateDose([245, 240, 230], DEFAULT_CALIBRATION);
    const midExposed = estimateDose([160, 130, 100], DEFAULT_CALIBRATION);
    const heavyExposed = estimateDose([80, 55, 40], DEFAULT_CALIBRATION);

    expect(unexposed.high).toBeLessThan(midExposed.low);
    expect(midExposed.high).toBeLessThan(heavyExposed.low);
  });

  it('maintains a minimum uncertainty margin of at least 0.5 ppm·h', () => {
    const res = estimateDose([245, 240, 230], DEFAULT_CALIBRATION);
    expect(res.high - res.low).toBeGreaterThanOrEqual(0.5);
  });
});

describe('Expiry Verification Module', () => {
  it('identifies fresh badge when sampled RGB is close to fresh anchor', () => {
    const freshSample = [122, 178, 92]; // Close to [120, 180, 90]
    const result = checkExpiry(freshSample);

    expect(result.valid).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.distFresh).toBeLessThan(result.distExpired);
  });

  it('identifies expired badge when sampled RGB is close to expired anchor', () => {
    const expiredSample = [182, 98, 78]; // Close to [180, 100, 80]
    const result = checkExpiry(expiredSample);

    expect(result.valid).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.distExpired).toBeLessThan(result.distFresh);
  });

  it('keeps confidence clamped between 0 and 1', () => {
    const extremeSample = [255, 0, 0];
    const result = checkExpiry(extremeSample);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
