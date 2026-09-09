/**
 * Setu — H₂S Dosimeter Reader
 * Main Application Entry Point
 */

import './styles/tokens.css';
import './styles/app.css';

import { applyWhiteBalance } from './colorimetry/colorCorrection.js';
import { estimateDose, DEFAULT_CALIBRATION } from './colorimetry/doseEstimate.js';
import { checkExpiry } from './colorimetry/expiryCheck.js';

import { startCamera, stopCamera, captureFrame } from './capture/camera.js';
import { domToCanvas, canvasToDom, sampleRegion } from './capture/tapCalibration.js';
import { autoDetectPoints } from './capture/autoDetect.js';

import {
  migrateFromLocalStorage,
  getReadings,
  saveReading,
  getExperiments,
  saveExperiment,
  deleteExperiment,
} from './storage/db.js';
import { exportReadingsCSV, exportExperimentsCSV } from './storage/csvExport.js';

import {
  $,
  $$,
  showView,
  renderLastReading,
  updateCalibrateUI,
  displayResults,
  renderHistoryList,
  renderExperimentsList,
  renderAdminTelemetry,
  darknessOf,
  delay,
  CALIBRATE_LABELS,
} from './ui/views.js';

// --- State ---
let currentStream = null;
let calibrateStep = 0; // 0=white ref, 1=exposure strip, 2=expiry patch
let sampledColors = [null, null, null];
let tapMarkers = [];
let currentResult = null;
let isAutoDetected = false;
let autoCountdownTimer = null;
let activeDragIndex = null;

// --- Elements ---
const workerIdInput = $('#worker-id');
const shiftSelect = $('#shift-select');
const btnStartCapture = $('#btn-start-capture');
const btnHistory = $('#btn-history');
const btnExperiments = $('#btn-experiments');

const btnExpAddToggle = $('#btn-exp-add-toggle');
const expFormCard = $('#exp-form-card');
const btnExpSave = $('#btn-exp-save');
const btnExpBack = $('#btn-exp-back');
const btnExpExportCSV = $('#btn-exp-export-csv');

const videoEl = $('#camera-video');
const btnCameraBack = $('#btn-camera-back');
const btnCapture = $('#btn-capture');
const btnCameraRetry = $('#btn-camera-retry');
const cameraErrorDiv = $('#camera-error');

const calibrateCanvas = $('#calibrate-canvas');
const calibrateWrap = $('#calibrate-wrap');
const btnCalBack = $('#btn-calibrate-back');
const btnCalUndo = $('#btn-calibrate-undo');
const btnCalAutoDetect = $('#btn-calibrate-autodetect');
const btnCalConfirm = $('#btn-calibrate-confirm');
const calibrateCountdownBar = $('#calibrate-countdown-bar');
const calibrateCountdownFill = $('#calibrate-countdown-fill');

const btnSaveReading = $('#btn-save-reading');
const btnAdjustCalibration = $('#btn-adjust-calibration');
const btnNewReading = $('#btn-new-reading');
const btnExportCSV = $('#btn-export-csv');
const btnHistoryBack = $('#btn-history-back');

const btnAdminPortal = $('#btn-admin-portal');
const btnAdminClose = $('#btn-admin-close');
const btnAdminBack = $('#btn-admin-back');
const btnAdminExportCSV = $('#btn-admin-export-csv');
const adminSearchInput = $('#admin-search-input');
const adminTabs = $$('.admin-tab');
let activeAdminTab = 'workers';

// --- Helper Functions ---
function updateStartBtn() {
  btnStartCapture.disabled = workerIdInput.value.trim().length === 0;
}

async function refreshLastReading() {
  const readings = await getReadings();
  renderLastReading(readings);
}

function clearCountdown() {
  if (autoCountdownTimer) {
    clearInterval(autoCountdownTimer);
    autoCountdownTimer = null;
  }
  if (calibrateCountdownBar) {
    calibrateCountdownBar.classList.add('hidden');
  }
  if (calibrateCountdownFill) {
    calibrateCountdownFill.style.width = '0%';
  }
}

function startAutoCountdown(durationMs = 2200) {
  clearCountdown();
  if (!calibrateCountdownBar || !calibrateCountdownFill) return;

  calibrateCountdownBar.classList.remove('hidden');
  calibrateCountdownFill.style.transition = 'none';
  calibrateCountdownFill.style.width = '0%';
  calibrateCountdownFill.offsetHeight; // trigger reflow
  calibrateCountdownFill.style.transition = `width ${durationMs}ms linear`;
  calibrateCountdownFill.style.width = '100%';

  const startTime = Date.now();
  autoCountdownTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, durationMs - elapsed);
    const sec = Math.ceil(remaining / 1000);
    updateCalibrateUI(3, sampledColors, true, sec);

    if (remaining <= 0) {
      clearCountdown();
      showView('processing');
      runAnalysis();
    }
  }, 120);
}

function resetCalibration() {
  clearCountdown();
  calibrateStep = 0;
  isAutoDetected = false;
  sampledColors = [null, null, null];
  tapMarkers.forEach(m => m.remove());
  tapMarkers = [];
  updateCalibrateUI(calibrateStep, sampledColors, false);
}

// --- Analysis Pipeline ---
async function runAnalysis() {
  const steps = [$('#proc-step-1'), $('#proc-step-2'), $('#proc-step-3')];
  steps.forEach(s => s.classList.remove('active', 'done'));
  steps[0].classList.add('active');

  // Step 1: white balance
  await delay(600);
  const whiteRef = sampledColors[0];
  const rawStrip = sampledColors[1];
  const rawExpiry = sampledColors[2];

  const correctedStrip = applyWhiteBalance(rawStrip, whiteRef);
  const correctedExpiry = applyWhiteBalance(rawExpiry, whiteRef);

  steps[0].classList.remove('active');
  steps[0].classList.add('done');
  steps[0].querySelector('.step-icon').textContent = '✓';
  steps[1].classList.add('active');

  // Step 2: dose estimation (enforcing range display)
  await delay(700);
  const dose = estimateDose(correctedStrip, DEFAULT_CALIBRATION);

  steps[1].classList.remove('active');
  steps[1].classList.add('done');
  steps[1].querySelector('.step-icon').textContent = '✓';
  steps[2].classList.add('active');

  // Step 3: expiry check
  await delay(500);
  const expiry = checkExpiry(correctedExpiry);

  steps[2].classList.remove('active');
  steps[2].classList.add('done');
  steps[2].querySelector('.step-icon').textContent = '✓';

  // Result object
  currentResult = {
    timestamp: new Date().toISOString(),
    workerId: workerIdInput.value.trim(),
    shift: shiftSelect.value,
    doseLow: dose.low,
    doseHigh: dose.high,
    unit: dose.unit,
    badgeValid: expiry.valid,
    expiryConfidence: expiry.confidence,
    rawColors: {
      whiteRef,
      rawStrip,
      rawExpiry,
      correctedStrip,
      correctedExpiry,
    },
  };

  await delay(400);
  displayResults(currentResult, dose, expiry);
}

// --- Event Listeners ---

// Welcome View
workerIdInput.addEventListener('input', updateStartBtn);

btnStartCapture.addEventListener('click', async () => {
  showView('camera');
  cameraErrorDiv.classList.add('hidden');
  try {
    currentStream = await startCamera(videoEl, 'environment');
  } catch {
    cameraErrorDiv.classList.remove('hidden');
  }
});

btnCameraRetry.addEventListener('click', async () => {
  cameraErrorDiv.classList.add('hidden');
  try {
    currentStream = await startCamera(videoEl, 'environment');
  } catch {
    cameraErrorDiv.classList.remove('hidden');
  }
});

btnCameraBack.addEventListener('click', () => {
  stopCamera(currentStream);
  currentStream = null;
  showView('welcome');
});

// --- Calibration Helpers ---
function createDraggableMarker(index, canvasX, canvasY, rgb) {
  const marker = document.createElement('div');
  marker.className = 'tap-marker';
  marker.dataset.index = String(index);
  marker.dataset.canvasX = String(canvasX);
  marker.dataset.canvasY = String(canvasY);

  const { domX, domY } = canvasToDom(canvasX, canvasY, calibrateCanvas);
  marker.style.left = domX + 'px';
  marker.style.top = domY + 'px';
  marker.innerHTML = `<span class="marker-num">${index + 1}</span>`;
  marker.style.backgroundColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`;

  const onPointerDown = (e) => {
    e.stopPropagation();
    clearCountdown();
    activeDragIndex = index;
    marker.setPointerCapture(e.pointerId);
    marker.classList.add('dragging');
  };

  const onPointerMove = (e) => {
    if (activeDragIndex !== index) return;
    e.stopPropagation();

    const coords = domToCanvas(e, calibrateCanvas);
    const w = calibrateCanvas.width || 1920;
    const h = calibrateCanvas.height || 1080;
    const margin = 10;
    const clampedX = Math.max(margin, Math.min(w - margin, coords.canvasX));
    const clampedY = Math.max(margin, Math.min(h - margin, coords.canvasY));

    marker.dataset.canvasX = String(clampedX);
    marker.dataset.canvasY = String(clampedY);

    const domPt = canvasToDom(clampedX, clampedY, calibrateCanvas);
    marker.style.left = domPt.domX + 'px';
    marker.style.top = domPt.domY + 'px';

    const sampleRadius = Math.max(10, Math.min(w, h) * 0.025);
    const newRgb = sampleRegion(calibrateCanvas, clampedX, clampedY, sampleRadius);
    sampledColors[index] = newRgb;
    marker.style.backgroundColor = `rgba(${newRgb[0]},${newRgb[1]},${newRgb[2]},0.35)`;

    const chipInfo = CALIBRATE_LABELS[index];
    if (chipInfo) {
      const swatch = $('#' + chipInfo.swatch);
      if (swatch) {
        swatch.classList.remove('hidden');
        swatch.style.background = `rgb(${newRgb[0]},${newRgb[1]},${newRgb[2]})`;
      }
    }
  };

  const onPointerUp = (e) => {
    if (activeDragIndex === index) {
      activeDragIndex = null;
      try {
        marker.releasePointerCapture(e.pointerId);
      } catch {}
      marker.classList.remove('dragging');
      updateCalibrateUI(3, sampledColors, isAutoDetected);
    }
  };

  marker.addEventListener('pointerdown', onPointerDown);
  marker.addEventListener('pointermove', onPointerMove);
  marker.addEventListener('pointerup', onPointerUp);
  marker.addEventListener('pointercancel', onPointerUp);

  return marker;
}

function autoPickupPoints() {
  clearCountdown();
  tapMarkers.forEach(m => m.remove());
  tapMarkers = [];
  isAutoDetected = true;

  const detected = autoDetectPoints(calibrateCanvas);
  const sampleRadius = Math.max(10, Math.min(calibrateCanvas.width, calibrateCanvas.height) * 0.025);

  detected.forEach((pt, i) => {
    const rgb = sampleRegion(calibrateCanvas, pt.canvasX, pt.canvasY, sampleRadius);
    sampledColors[i] = rgb;
    const marker = createDraggableMarker(i, pt.canvasX, pt.canvasY, rgb);
    calibrateWrap.appendChild(marker);
    tapMarkers.push(marker);
  });

  calibrateStep = 3;
  updateCalibrateUI(3, sampledColors, true, 2);
  startAutoCountdown(2200);
}

// Keep markers properly aligned when container resizes or device rotates
window.addEventListener('resize', () => {
  if (tapMarkers.length === 0) return;
  tapMarkers.forEach(marker => {
    const cx = Number(marker.dataset.canvasX);
    const cy = Number(marker.dataset.canvasY);
    if (!isNaN(cx) && !isNaN(cy)) {
      const { domX, domY } = canvasToDom(cx, cy, calibrateCanvas);
      marker.style.left = domX + 'px';
      marker.style.top = domY + 'px';
    }
  });
});

// Camera Capture - Automatically fetch all 3 points/colors and run analysis directly
btnCapture.addEventListener('click', () => {
  captureFrame(videoEl, calibrateCanvas);
  stopCamera(currentStream);
  currentStream = null;

  // 1. Automatically detect calibration points
  const detected = autoDetectPoints(calibrateCanvas);
  const sampleRadius = Math.max(10, Math.min(calibrateCanvas.width, calibrateCanvas.height) * 0.025);

  // 2. Automatically fetch all 3 colors
  detected.forEach((pt, i) => {
    sampledColors[i] = sampleRegion(calibrateCanvas, pt.canvasX, pt.canvasY, sampleRadius);
  });

  // 3. Pre-position markers on canvas in case user inspects/adjusts later
  tapMarkers.forEach(m => m.remove());
  tapMarkers = [];
  detected.forEach((pt, i) => {
    const marker = createDraggableMarker(i, pt.canvasX, pt.canvasY, sampledColors[i]);
    calibrateWrap.appendChild(marker);
    tapMarkers.push(marker);
  });
  calibrateStep = 3;
  isAutoDetected = true;
  updateCalibrateUI(3, sampledColors, true);

  // 4. Immediately proceed to analysis without asking the user to select colors
  showView('processing');
  runAnalysis();
});

// Calibration Tap/Click Interaction
calibrateWrap.addEventListener('click', (e) => {
  if (e.target.closest('.calibrate-bottom-bar') || e.target.closest('.calibrate-hud') || e.target.closest('.tap-marker')) {
    return;
  }
  clearCountdown();

  const coords = domToCanvas(e, calibrateCanvas);
  if (
    coords.canvasX < 0 ||
    coords.canvasY < 0 ||
    coords.canvasX > calibrateCanvas.width ||
    coords.canvasY > calibrateCanvas.height
  ) {
    return;
  }

  const sampleRadius = Math.max(10, Math.min(calibrateCanvas.width, calibrateCanvas.height) * 0.025);
  const rgb = sampleRegion(calibrateCanvas, coords.canvasX, coords.canvasY, sampleRadius);

  if (calibrateStep < 3) {
    sampledColors[calibrateStep] = rgb;
    const marker = createDraggableMarker(calibrateStep, coords.canvasX, coords.canvasY, rgb);
    calibrateWrap.appendChild(marker);
    tapMarkers.push(marker);

    calibrateStep++;
    updateCalibrateUI(calibrateStep, sampledColors, false);
  } else if (tapMarkers.length === 3) {
    let closestIdx = 0;
    let minDist = Infinity;
    tapMarkers.forEach((m, idx) => {
      const mx = Number(m.dataset.canvasX);
      const my = Number(m.dataset.canvasY);
      const dist = (mx - coords.canvasX) ** 2 + (my - coords.canvasY) ** 2;
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    sampledColors[closestIdx] = rgb;
    const marker = tapMarkers[closestIdx];
    marker.dataset.canvasX = String(coords.canvasX);
    marker.dataset.canvasY = String(coords.canvasY);
    const domPt = canvasToDom(coords.canvasX, coords.canvasY, calibrateCanvas);
    marker.style.left = domPt.domX + 'px';
    marker.style.top = domPt.domY + 'px';
    marker.style.backgroundColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`;
    updateCalibrateUI(3, sampledColors, isAutoDetected);
  }
});

if (btnCalAutoDetect) {
  btnCalAutoDetect.addEventListener('click', () => {
    autoPickupPoints();
  });
}

btnCalUndo.addEventListener('click', () => {
  clearCountdown();
  resetCalibration();
});

btnCalBack.addEventListener('click', async () => {
  clearCountdown();
  if (currentResult) {
    showView('results');
    return;
  }
  resetCalibration();
  showView('camera');
  cameraErrorDiv.classList.add('hidden');
  try {
    currentStream = await startCamera(videoEl, 'environment');
  } catch {
    cameraErrorDiv.classList.remove('hidden');
  }
});

btnCalConfirm.addEventListener('click', () => {
  clearCountdown();
  showView('processing');
  runAnalysis();
});

if (btnAdjustCalibration) {
  btnAdjustCalibration.addEventListener('click', () => {
    showView('calibrate');
    updateCalibrateUI(3, sampledColors, true);
    if (btnCalConfirm) {
      btnCalConfirm.textContent = 'Re-Analyze →';
      btnCalConfirm.disabled = false;
    }
  });
}

// Results
btnSaveReading.addEventListener('click', async () => {
  if (!currentResult) return;
  await saveReading(currentResult);
  btnSaveReading.disabled = true;
  btnSaveReading.textContent = 'Saved ✓';
  refreshLastReading();
});

btnNewReading.addEventListener('click', () => {
  currentResult = null;
  showView('welcome');
  refreshLastReading();
});

// History
btnHistory.addEventListener('click', async () => {
  const readings = await getReadings();
  renderHistoryList(readings);
  showView('history');
});

btnHistoryBack.addEventListener('click', () => {
  showView('welcome');
  refreshLastReading();
});

btnExportCSV.addEventListener('click', async () => {
  const readings = await getReadings();
  if (readings.length === 0) return;
  exportReadingsCSV(readings);
});

// Experiments Dashboard
async function refreshExperimentsView() {
  const experiments = await getExperiments();
  renderExperimentsList(experiments, async (id) => {
    await deleteExperiment(id);
    refreshExperimentsView();
  });
}

btnExperiments.addEventListener('click', async () => {
  await refreshExperimentsView();
  showView('experiments');
});

btnExpBack.addEventListener('click', () => {
  expFormCard.classList.add('hidden');
  btnExpAddToggle.textContent = '+ Log new experiment';
  showView('welcome');
  refreshLastReading();
});

btnExpAddToggle.addEventListener('click', () => {
  const isHidden = expFormCard.classList.toggle('hidden');
  btnExpAddToggle.textContent = isHidden ? '+ Log new experiment' : '✕ Close form';
});

btnExpSave.addEventListener('click', async () => {
  const rgbRaw = $('#exp-rgb').value.split(',').map(v => parseInt(v.trim(), 10));
  if (rgbRaw.length !== 3 || rgbRaw.some(isNaN)) {
    $('#exp-rgb').style.borderColor = 'var(--danger-glow)';
    return;
  }
  $('#exp-rgb').style.borderColor = '';

  const entry = {
    id: 'exp_' + Date.now(),
    timestamp: new Date().toISOString(),
    batch: $('#exp-batch').value.trim() || 'UNSPECIFIED',
    targetPpmH: parseFloat($('#exp-target-ppmh').value) || 0,
    durationH: parseFloat($('#exp-duration').value) || 0,
    chamberConc: parseFloat($('#exp-conc').value) || 0,
    chamberTemp: parseFloat($('#exp-temp').value) || 0,
    chamberRh: parseFloat($('#exp-rh').value) || 0,
    rgb: rgbRaw,
    darkness: darknessOf(rgbRaw),
    operator: $('#exp-operator').value.trim(),
    notes: $('#exp-notes').value.trim(),
  };

  await saveExperiment(entry);

  // Reset form
  ['exp-batch', 'exp-target-ppmh', 'exp-duration', 'exp-conc', 'exp-temp', 'exp-rh', 'exp-rgb', 'exp-operator', 'exp-notes']
    .forEach(id => { $('#' + id).value = ''; });
  expFormCard.classList.add('hidden');
  btnExpAddToggle.textContent = '+ Log new experiment';

  await refreshExperimentsView();
});

btnExpExportCSV.addEventListener('click', async () => {
  const experiments = await getExperiments();
  if (experiments.length === 0) return;
  exportExperimentsCSV(experiments);
});

// --- Admin Telemetry & Badge Control Handlers ---
async function refreshAdminDashboard() {
  const readings = await getReadings();
  const experiments = await getExperiments();
  const query = adminSearchInput ? adminSearchInput.value : '';
  renderAdminTelemetry(readings, experiments, query, activeAdminTab);
}

if (btnAdminPortal) {
  btnAdminPortal.addEventListener('click', async () => {
    showView('admin');
    await refreshAdminDashboard();
  });
}

if (btnAdminClose) {
  btnAdminClose.addEventListener('click', () => {
    showView('welcome');
    refreshLastReading();
  });
}

if (btnAdminBack) {
  btnAdminBack.addEventListener('click', () => {
    showView('welcome');
    refreshLastReading();
  });
}

adminTabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    adminTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    activeAdminTab = tab.dataset.tab;

    // Toggle tab panes
    $$('.admin-tab-pane').forEach(pane => pane.classList.add('hidden'));
    const targetPane = $(`#pane-${activeAdminTab}`);
    if (targetPane) targetPane.classList.remove('hidden');

    await refreshAdminDashboard();
  });
});

if (adminSearchInput) {
  adminSearchInput.addEventListener('input', async () => {
    await refreshAdminDashboard();
  });
}

if (btnAdminExportCSV) {
  btnAdminExportCSV.addEventListener('click', async () => {
    const readings = await getReadings();
    if (readings.length === 0) return;
    exportReadingsCSV(readings);
  });
}

// --- Service Worker Registration & Cache Invalidation ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // In local development, purge stale caches and unregister existing service workers
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) {
          reg.unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      }
      return;
    }

    if (window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  }
}

// --- Application Initialization ---
async function init() {
  await migrateFromLocalStorage();
  await refreshLastReading();
  updateStartBtn();
  registerServiceWorker();
}

init();
