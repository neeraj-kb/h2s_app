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
import { domToCanvas, sampleRegion } from './capture/tapCalibration.js';

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
  darknessOf,
  delay,
} from './ui/views.js';

// --- State ---
let currentStream = null;
let calibrateStep = 0; // 0=white ref, 1=exposure strip, 2=expiry patch
let sampledColors = [null, null, null];
let tapMarkers = [];
let currentResult = null;

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
const btnCalConfirm = $('#btn-calibrate-confirm');

const btnSaveReading = $('#btn-save-reading');
const btnNewReading = $('#btn-new-reading');
const btnExportCSV = $('#btn-export-csv');
const btnHistoryBack = $('#btn-history-back');

// --- Helper Functions ---
function updateStartBtn() {
  btnStartCapture.disabled = workerIdInput.value.trim().length === 0;
}

async function refreshLastReading() {
  const readings = await getReadings();
  renderLastReading(readings);
}

function resetCalibration() {
  calibrateStep = 0;
  sampledColors = [null, null, null];
  tapMarkers.forEach(m => m.remove());
  tapMarkers = [];
  updateCalibrateUI(calibrateStep, sampledColors);
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

// Camera Capture
btnCapture.addEventListener('click', () => {
  captureFrame(videoEl, calibrateCanvas);
  stopCamera(currentStream);
  currentStream = null;
  resetCalibration();
  showView('calibrate');
});

// Calibration
calibrateWrap.addEventListener('click', (e) => {
  if (calibrateStep >= 3) return;
  if (e.target.closest('.calibrate-bottom-bar') || e.target.closest('.calibrate-hud')) return;

  const coords = domToCanvas(e, calibrateCanvas);
  if (
    coords.canvasX < 0 ||
    coords.canvasY < 0 ||
    coords.canvasX > calibrateCanvas.width ||
    coords.canvasY > calibrateCanvas.height
  ) {
    return;
  }

  // Sample pixels
  const sampleRadius = Math.max(10, Math.min(calibrateCanvas.width, calibrateCanvas.height) * 0.025);
  const rgb = sampleRegion(calibrateCanvas, coords.canvasX, coords.canvasY, sampleRadius);
  sampledColors[calibrateStep] = rgb;

  // Create visual marker
  const marker = document.createElement('div');
  marker.className = 'tap-marker';
  marker.style.left = coords.domX + 'px';
  marker.style.top = coords.domY + 'px';
  marker.innerHTML = `<span class="marker-num">${calibrateStep + 1}</span>`;
  marker.style.backgroundColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)`;
  calibrateWrap.appendChild(marker);
  tapMarkers.push(marker);

  calibrateStep++;
  updateCalibrateUI(calibrateStep, sampledColors);
});

btnCalUndo.addEventListener('click', () => {
  if (calibrateStep <= 0) return;
  calibrateStep--;
  sampledColors[calibrateStep] = null;
  const marker = tapMarkers.pop();
  if (marker) marker.remove();
  updateCalibrateUI(calibrateStep, sampledColors);
});

btnCalBack.addEventListener('click', async () => {
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
  showView('processing');
  runAnalysis();
});

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
  showView('welcome');
  refreshLastReading();
});

btnExpAddToggle.addEventListener('click', () => {
  expFormCard.classList.toggle('hidden');
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

  await refreshExperimentsView();
});

btnExpExportCSV.addEventListener('click', async () => {
  const experiments = await getExperiments();
  if (experiments.length === 0) return;
  exportExperimentsCSV(experiments);
});

// --- Service Worker Registration ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    });
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
