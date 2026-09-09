/**
 * Experiments Chart Component
 * Renders lab calibration data points and dose-vs-darkness curve on a 2D canvas.
 */

/**
 * Draw experiments calibration chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<object>} experiments
 */
export function drawExperimentsChart(canvas, experiments) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.round(rect.width) || canvas.width || 360;
  const displayHeight = Math.round(rect.height) || canvas.height || 150;

  if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  const w = displayWidth;
  const h = displayHeight;
  const padLeft = 40;
  const padBottom = 26;
  const padTop = 22;
  const padRight = 16;

  ctx.clearRect(0, 0, w, h);

  // Axes
  ctx.strokeStyle = 'rgba(242,239,230,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Y-axis
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, h - padBottom);
  // X-axis
  ctx.lineTo(w - padRight, h - padBottom);
  ctx.stroke();

  // Labels & Ticks
  ctx.fillStyle = 'rgba(242,239,230,0.45)';
  ctx.font = '9px monospace';

  // Y-axis title placed above Y-axis
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Darkness', padLeft, padTop - 5);

  // X-axis title placed at right below X-axis
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('Dose (ppm·h) →', w - padRight, h - padBottom + 6);

  // Tick marks on Y axis
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('255', padLeft - 6, padTop + 2);
  ctx.fillText('0', padLeft - 6, h - padBottom);

  if (!experiments || experiments.length === 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(242,239,230,0.2)';
    ctx.fillText('No data points yet', padLeft + (w - padLeft - padRight) / 2, padTop + (h - padTop - padBottom) / 2);
    ctx.restore();
    return;
  }

  const maxDose = Math.max(...experiments.map(e => e.targetPpmH || 0), 1);
  const maxDarkness = 255;

  const toX = v => padLeft + (v / maxDose) * (w - padLeft - padRight - 8);
  const toY = v => (h - padBottom) - (v / maxDarkness) * (h - padBottom - padTop);

  // Sort by dose for connecting line
  const sorted = [...experiments].sort((a, b) => (a.targetPpmH || 0) - (b.targetPpmH || 0));
  ctx.strokeStyle = 'rgba(214,154,45,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  sorted.forEach((e, i) => {
    const x = toX(e.targetPpmH || 0);
    const y = toY(e.darkness || 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  experiments.forEach(e => {
    const x = toX(e.targetPpmH || 0);
    const y = toY(e.darkness || 0);
    ctx.fillStyle = e.rgb ? `rgb(${e.rgb.join(',')})` : 'rgba(214,154,45,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,239,230,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.restore();
}
