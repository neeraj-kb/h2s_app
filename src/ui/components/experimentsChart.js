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
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pad = 28;
  ctx.clearRect(0, 0, w, h);

  // Axes
  ctx.strokeStyle = 'rgba(242,239,230,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 8);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - 8, h - pad);
  ctx.stroke();

  ctx.fillStyle = 'rgba(242,239,230,0.4)';
  ctx.font = '9px monospace';
  ctx.fillText('darkness', 2, 14);
  ctx.fillText('dose (ppm·h) →', w - 100, h - 8);

  if (!experiments || experiments.length === 0) return;

  const maxDose = Math.max(...experiments.map(e => e.targetPpmH || 0), 1);
  const maxDarkness = 255;

  const toX = v => pad + (v / maxDose) * (w - pad - 16);
  const toY = v => (h - pad) - (v / maxDarkness) * (h - pad - 16);

  // Sort by dose for connecting line
  const sorted = [...experiments].sort((a, b) => (a.targetPpmH || 0) - (b.targetPpmH || 0));
  ctx.strokeStyle = 'rgba(214,154,45,0.5)';
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
    ctx.fillStyle = e.rgb ? `rgb(${e.rgb.join(',')})` : 'rgba(214,154,45,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,239,230,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}
