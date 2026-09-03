/**
 * IndexedDB Storage Layer using idb
 * Stores worker field readings and lab calibration experiments.
 * Automatically migrates existing localStorage prototype data on startup.
 */

import { openDB } from 'idb';

const DB_NAME = 'setu_db';
const DB_VERSION = 1;

let dbPromise = null;
const memoryFallbackReadings = [];
const memoryFallbackExperiments = [];

/**
 * Initialize IndexedDB instance with 'readings' and 'experiments' object stores.
 */
export async function getDB() {
  if (typeof indexedDB === 'undefined') {
    return null; // Fallback to memory
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('readings')) {
          const readingStore = db.createObjectStore('readings', { keyPath: 'id' });
          readingStore.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('experiments')) {
          const expStore = db.createObjectStore('experiments', { keyPath: 'id' });
          expStore.createIndex('timestamp', 'timestamp');
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Migrate legacy prototype data from localStorage if found.
 */
export async function migrateFromLocalStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // Migrate readings
    const legacyReadingsRaw = window.localStorage.getItem('setu_readings');
    if (legacyReadingsRaw) {
      const legacyReadings = JSON.parse(legacyReadingsRaw);
      if (Array.isArray(legacyReadings) && legacyReadings.length > 0) {
        const existing = await getReadings();
        const existingIds = new Set(existing.map(r => r.id || r.timestamp));
        for (const r of legacyReadings) {
          const id = r.id || ('reading_' + (new Date(r.timestamp).getTime() || Date.now()));
          if (!existingIds.has(id)) {
            await saveReading({ ...r, id });
          }
        }
      }
    }

    // Migrate experiments
    const legacyExpRaw = window.localStorage.getItem('setu_experiments');
    if (legacyExpRaw) {
      const legacyExp = JSON.parse(legacyExpRaw);
      if (Array.isArray(legacyExp) && legacyExp.length > 0) {
        const existing = await getExperiments();
        const existingIds = new Set(existing.map(e => e.id));
        for (const e of legacyExp) {
          if (!existingIds.has(e.id)) {
            await saveExperiment(e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('LocalStorage migration skipped:', err);
  }
}

// ---------------------------------------------------------------------------
// Readings Operations
// ---------------------------------------------------------------------------

/**
 * Retrieve all saved readings, ordered newest first.
 * @returns {Promise<Array<object>>}
 */
export async function getReadings() {
  const db = await getDB();
  if (!db) {
    return [...memoryFallbackReadings];
  }
  const all = await db.getAllFromIndex('readings', 'timestamp');
  return all.reverse();
}

/**
 * Save a new reading to IndexedDB.
 * @param {object} reading
 * @returns {Promise<string>} id
 */
export async function saveReading(reading) {
  const item = {
    id: reading.id || 'reading_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: reading.timestamp || new Date().toISOString(),
    ...reading,
  };

  const db = await getDB();
  if (!db) {
    memoryFallbackReadings.unshift(item);
    return item.id;
  }

  await db.put('readings', item);
  return item.id;
}

// ---------------------------------------------------------------------------
// Experiments Operations
// ---------------------------------------------------------------------------

/**
 * Retrieve all lab calibration experiments, ordered newest first.
 * @returns {Promise<Array<object>>}
 */
export async function getExperiments() {
  const db = await getDB();
  if (!db) {
    return [...memoryFallbackExperiments];
  }
  const all = await db.getAllFromIndex('experiments', 'timestamp');
  return all.reverse();
}

/**
 * Save a new lab calibration experiment.
 * @param {object} experiment
 * @returns {Promise<string>} id
 */
export async function saveExperiment(experiment) {
  const item = {
    id: experiment.id || 'exp_' + Date.now(),
    timestamp: experiment.timestamp || new Date().toISOString(),
    ...experiment,
  };

  const db = await getDB();
  if (!db) {
    memoryFallbackExperiments.unshift(item);
    return item.id;
  }

  await db.put('experiments', item);
  return item.id;
}

/**
 * Delete a lab experiment by ID.
 * @param {string} id
 */
export async function deleteExperiment(id) {
  const db = await getDB();
  if (!db) {
    const idx = memoryFallbackExperiments.findIndex(e => e.id === id);
    if (idx !== -1) memoryFallbackExperiments.splice(idx, 1);
    return;
  }
  await db.delete('experiments', id);
}
