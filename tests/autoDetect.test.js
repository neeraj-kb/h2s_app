import { describe, it, expect } from 'vitest';
import { autoDetectPoints, DEFAULT_NORMALIZED_POINTS } from '../src/capture/autoDetect.js';
import { canvasToDom, domToCanvas } from '../src/capture/tapCalibration.js';

describe('Auto-Detection Module', () => {
  it('returns exactly 3 points with correct labels and IDs for standard 1920x1080 canvas', () => {
    const mockCanvas = {
      width: 1920,
      height: 1080,
      getContext: () => null, // fallback geometric priors
    };

    const points = autoDetectPoints(mockCanvas);
    expect(points).toHaveLength(3);

    expect(points[0].id).toBe('ref');
    expect(points[0].label).toBe('White Ref');

    expect(points[1].id).toBe('strip');
    expect(points[1].label).toBe('Exposure Strip');

    expect(points[2].id).toBe('expiry');
    expect(points[2].label).toBe('Expiry Patch');

    // Expected geometric values based on reticle anchors
    expect(points[0].canvasX).toBe(Math.round(1920 * 0.22));
    expect(points[0].canvasY).toBe(Math.round(1080 * 0.70));

    expect(points[1].canvasX).toBe(Math.round(1920 * 0.50));
    expect(points[1].canvasY).toBe(Math.round(1080 * 0.46));

    expect(points[2].canvasX).toBe(Math.round(1920 * 0.76));
    expect(points[2].canvasY).toBe(Math.round(1080 * 0.22));
  });

  it('keeps all 3 coordinates clamped safely within canvas boundaries', () => {
    const mockCanvas = {
      width: 400,
      height: 300,
      getContext: () => null,
    };

    const points = autoDetectPoints(mockCanvas);
    points.forEach((pt) => {
      expect(pt.canvasX).toBeGreaterThanOrEqual(12);
      expect(pt.canvasX).toBeLessThanOrEqual(mockCanvas.width - 12);
      expect(pt.canvasY).toBeGreaterThanOrEqual(12);
      expect(pt.canvasY).toBeLessThanOrEqual(mockCanvas.height - 12);
    });
  });

  it('preserves geometry on square aspect ratio canvas', () => {
    const mockCanvas = {
      width: 1000,
      height: 1000,
      getContext: () => null,
    };

    const points = autoDetectPoints(mockCanvas);
    expect(points[0].canvasX).toBe(220);
    expect(points[0].canvasY).toBe(700);
    expect(points[1].canvasX).toBe(500);
    expect(points[1].canvasY).toBe(460);
    expect(points[2].canvasX).toBe(760);
    expect(points[2].canvasY).toBe(220);
  });
});

describe('Coordinate Transformation Round-Trip (canvasToDom & domToCanvas)', () => {
  it('correctly maps canvas coordinates to DOM coordinates and back for letterbox container', () => {
    const mockCanvas = {
      width: 1920,
      height: 1080,
      getBoundingClientRect: () => ({
        left: 50,
        top: 100,
        width: 800,
        height: 600, // 800x600 container for 16:9 canvas -> letterbox top/bottom
      }),
    };

    const originalX = 400;
    const originalY = 300;

    const { domX, domY } = canvasToDom(originalX, originalY, mockCanvas);

    // Mock client event at that DOM position
    const mockEvent = {
      clientX: domX + 50,
      clientY: domY + 100,
    };

    const mapped = domToCanvas(mockEvent, mockCanvas);

    expect(Math.abs(mapped.canvasX - originalX)).toBeLessThanOrEqual(2);
    expect(Math.abs(mapped.canvasY - originalY)).toBeLessThanOrEqual(2);
  });

  it('correctly maps canvas coordinates to DOM coordinates and back for pillarbox container', () => {
    const mockCanvas = {
      width: 1080,
      height: 1920, // tall portrait canvas
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600, // wide container -> pillarbox left/right
      }),
    };

    const originalX = 540;
    const originalY = 960;

    const { domX, domY } = canvasToDom(originalX, originalY, mockCanvas);

    const mockEvent = {
      clientX: domX,
      clientY: domY,
    };

    const mapped = domToCanvas(mockEvent, mockCanvas);

    expect(Math.abs(mapped.canvasX - originalX)).toBeLessThanOrEqual(2);
    expect(Math.abs(mapped.canvasY - originalY)).toBeLessThanOrEqual(2);
  });
});
