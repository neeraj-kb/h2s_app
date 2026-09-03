/**
 * UI Views and Controller Module
 */

import { drawExperimentsChart } from './components/experimentsChart.js';

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export const views = {
  welcome: $('#view-welcome'),
  camera: $('#view-camera'),
  calibrate: $('#view-calibrate'),
  processing: $('#view-processing'),
  results: $('#view-results'),
  history: $('#view-history'),
  experiments: $('#view-experiments'),
};

export const CALIBRATE_LABELS = [
  { step: 'Step 1 of 3', instruction: 'Tap the white reference area on the printed scale', chip: 'chip-ref', swatch: 'swatch-ref' },
  { step: 'Step 2 of 3', instruction: 'Tap the exposure strip on the badge', chip: 'chip-strip', swatch: 'swatch-strip' },
  { step: 'Step 3 of 3', instruction: 'Tap the expiry patch on the badge', chip: 'chip-expiry', swatch: 'swatch-expiry' },
];

/**
 * Switch active view with smooth entrance animation.
 * @param {string} name
 */
export function showView(name) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove('active');
  });
  if (views[name]) {
    views[name].classList.add('active');
    views[name].style.animation = 'none';
    views[name].offsetHeight; // trigger reflow
    views[name].style.animation = '';
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function darknessOf(rgb) {
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return 255 - lum;
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update the last reading card on the welcome screen.
 * @param {Array<object>} readings
 */
export function renderLastReading(readings) {
  const section = $('#last-reading-section');
  if (!section) return;

  if (!readings || readings.length === 0) {
    section.classList.add('hidden');
    return;
  }

  const last = readings[0];
  section.classList.remove('hidden');
  const doseEl = $('#last-reading-dose');
  doseEl.textContent = `${last.doseLow} – ${last.doseHigh} ${last.unit}`;

  const dt = new Date(last.timestamp);
  $('#last-reading-meta').innerHTML =
    `${escapeHtml(last.workerId)}<br>${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const mid = (last.doseLow + last.doseHigh) / 2;
  doseEl.classList.remove('text-safe', 'text-amber', 'text-danger');
  if (mid <= 5) doseEl.classList.add('text-safe');
  else if (mid <= 20) doseEl.classList.add('text-amber');
  else doseEl.classList.add('text-danger');
}

/**
 * Update calibration HUD and step chips.
 * @param {number} step
 * @param {Array<[number, number, number]|null>} sampledColors
 */
export function updateCalibrateUI(step, sampledColors) {
  const stepLabel = $('#calibrate-step-label');
  const instruction = $('#calibrate-instruction');
  const btnUndo = $('#btn-calibrate-undo');
  const btnConfirm = $('#btn-calibrate-confirm');

  if (step < 3) {
    const info = CALIBRATE_LABELS[step];
    stepLabel.textContent = info.step;
    instruction.textContent = info.instruction;
  } else {
    stepLabel.textContent = 'All samples taken';
    instruction.textContent = 'Review and confirm, or undo the last tap';
  }

  CALIBRATE_LABELS.forEach((info, i) => {
    const chip = $('#' + info.chip);
    const swatch = $('#' + info.swatch);
    if (!chip || !swatch) return;

    chip.classList.remove('done', 'active');
    swatch.classList.add('hidden');

    if (sampledColors[i]) {
      chip.classList.add('done');
      swatch.classList.remove('hidden');
      const [r, g, b] = sampledColors[i];
      swatch.style.background = `rgb(${r},${g},${b})`;
    } else if (i === step) {
      chip.classList.add('active');
    }
  });

  btnUndo.disabled = step === 0;
  btnConfirm.disabled = step < 3;
}

/**
 * Display dose and expiry results on results screen.
 * @param {object} result
 * @param {object} dose
 * @param {object} expiry
 */
export function displayResults(result, dose, expiry) {
  showView('results');

  const dt = new Date(result.timestamp);
  $('#result-datetime').textContent =
    `${dt.toLocaleDateString()} · ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${escapeHtml(result.workerId)} · ${escapeHtml(result.shift)}`;

  // Enforce range format
  const doseEl = $('#result-dose-range');
  doseEl.textContent = `${dose.low} – ${dose.high}`;

  const mid = (dose.low + dose.high) / 2;
  doseEl.classList.remove('text-safe', 'text-amber', 'text-danger');
  if (mid <= 5) doseEl.classList.add('text-safe');
  else if (mid <= 20) doseEl.classList.add('text-amber');
  else doseEl.classList.add('text-danger');

  // Risk indicator position (0-50 ppm·h mapped to 0-100%)
  const pct = Math.min(100, Math.max(0, (mid / 50) * 100));
  $('#risk-indicator').style.left = `${pct}%`;

  // Validity
  const validIcon = $('#validity-icon');
  const validTitle = $('#validity-title');
  const validDesc = $('#validity-desc');
  validIcon.className = 'validity-icon ' + (expiry.valid ? 'valid' : 'expired');
  validIcon.textContent = expiry.valid ? '✓' : '✗';
  validTitle.textContent = expiry.valid ? 'Badge Valid' : 'Badge Expired';
  validTitle.style.color = expiry.valid ? 'var(--safe-glow)' : 'var(--danger-glow)';
  validDesc.textContent = `Confidence: ${Math.round(expiry.confidence * 100)}%`;

  // Color swatches
  const samplesDiv = $('#color-samples');
  samplesDiv.innerHTML = '';
  const labels = ['White Ref', 'Strip (raw)', 'Expiry (raw)', 'Strip (corr.)', 'Expiry (corr.)'];
  const colors = [
    result.rawColors.whiteRef,
    result.rawColors.rawStrip,
    result.rawColors.rawExpiry,
    result.rawColors.correctedStrip,
    result.rawColors.correctedExpiry,
  ];
  labels.forEach((lbl, i) => {
    const [r, g, b] = colors[i] || [128, 128, 128];
    const el = document.createElement('div');
    el.className = 'color-sample';
    el.innerHTML =
      `<div class="color-swatch" style="background:rgb(${r},${g},${b})"></div>` +
      `<span class="label">${lbl}</span>`;
    samplesDiv.appendChild(el);
  });

  const btnSave = $('#btn-save-reading');
  btnSave.disabled = false;
  btnSave.textContent = 'Save Reading';
}

/**
 * Render history list.
 * @param {Array<object>} readings
 */
export function renderHistoryList(readings) {
  const listEl = $('#history-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!readings || readings.length === 0) {
    listEl.innerHTML =
      '<div class="history-empty">' +
      '<div class="empty-icon">📋</div>' +
      '<p>No readings saved yet.</p>' +
      '</div>';
    return;
  }

  readings.forEach(r => {
    const mid = (r.doseLow + r.doseHigh) / 2;
    let riskClass = 'safe';
    if (mid > 20) riskClass = 'danger';
    else if (mid > 5) riskClass = 'caution';

    const dt = new Date(r.timestamp);
    const dateStr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML =
      `<div class="history-risk-dot ${riskClass}"></div>` +
      '<div class="history-item-body">' +
      `<div class="history-dose">${r.doseLow} – ${r.doseHigh} ${r.unit}</div>` +
      `<div class="history-meta">${escapeHtml(r.workerId)} · ${escapeHtml(r.shift)} · ${dateStr}</div>` +
      '</div>' +
      `<span class="history-badge-status ${r.badgeValid ? 'valid' : 'expired'}">` +
      (r.badgeValid ? 'Valid' : 'Expired') +
      '</span>';
    listEl.appendChild(el);
  });
}

/**
 * Render experiments list and chart.
 * @param {Array<object>} experiments
 * @param {function(string): void} onDelete
 */
export function renderExperimentsList(experiments, onDelete) {
  const expList = $('#exp-list');
  const expChart = $('#exp-chart');
  if (!expList) return;
  expList.innerHTML = '';

  if (!experiments || experiments.length === 0) {
    expList.innerHTML =
      '<div class="exp-empty">' +
      '<div class="empty-icon">🧪</div>' +
      '<p>No experiments logged yet.</p>' +
      '</div>';
  } else {
    experiments.forEach(e => {
      const dt = new Date(e.timestamp);
      const dateStr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const el = document.createElement('div');
      el.className = 'exp-item';
      el.innerHTML =
        `<div class="exp-swatch" style="background: rgb(${e.rgb.join(',')})"></div>` +
        '<div class="exp-item-body">' +
        `<div class="exp-item-title">${escapeHtml(e.batch)} · target ${e.targetPpmH} ppm·h</div>` +
        '<div class="exp-item-meta">' +
        `${e.durationH}h @ ${e.chamberConc} ppm · ${e.chamberTemp}°C / ${e.chamberRh}%RH · ${dateStr}` +
        (e.operator ? ` · ${escapeHtml(e.operator)}` : '') +
        '</div>' +
        (e.notes ? `<div class="exp-item-notes">${escapeHtml(e.notes)}</div>` : '') +
        '</div>' +
        `<button class="exp-item-del" data-id="${e.id}" title="Delete">✕</button>`;
      expList.appendChild(el);
    });

    expList.querySelectorAll('.exp-item-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onDelete) onDelete(btn.dataset.id);
      });
    });
  }

  if (expChart) {
    drawExperimentsChart(expChart, experiments);
  }
}
