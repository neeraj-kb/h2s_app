/**
 * CSV Export Module
 * Generates and triggers download of CSV files for readings and lab calibration experiments.
 */

/**
 * Triggers a browser download of a CSV file.
 * @param {string} filename
 * @param {string} header
 * @param {Array<string>} rows
 */
export function downloadCSV(filename, header, rows) {
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export worker field readings to CSV.
 * @param {Array<object>} readings
 */
export function exportReadingsCSV(readings) {
  const header = 'timestamp,worker_id,shift,dose_low,dose_high,unit,badge_valid,expiry_confidence\n';
  const rows = readings.map(r =>
    [
      r.timestamp,
      '"' + (r.workerId || '').replace(/"/g, '""') + '"',
      r.shift,
      r.doseLow,
      r.doseHigh,
      r.unit,
      r.badgeValid,
      r.expiryConfidence,
    ].join(',')
  );
  downloadCSV('setu_readings_' + new Date().toISOString().slice(0, 10) + '.csv', header, rows);
}

/**
 * Export lab calibration experiments to CSV.
 * @param {Array<object>} experiments
 */
export function exportExperimentsCSV(experiments) {
  const header = 'timestamp,batch_id,target_ppmh,duration_h,chamber_conc_ppm,chamber_temp_c,chamber_rh_pct,measured_rgb,darkness_signal,operator,notes\n';
  const rows = experiments.map(e =>
    [
      e.timestamp,
      '"' + (e.batch || '').replace(/"/g, '""') + '"',
      e.targetPpmH,
      e.durationH,
      e.chamberConc,
      e.chamberTemp,
      e.chamberRh,
      '"' + (e.rgb ? e.rgb.join(',') : '') + '"',
      (e.darkness != null ? e.darkness.toFixed(1) : ''),
      '"' + (e.operator || '').replace(/"/g, '""') + '"',
      '"' + (e.notes || '').replace(/"/g, '""') + '"',
    ].join(',')
  );
  downloadCSV('setu_experiments_' + new Date().toISOString().slice(0, 10) + '.csv', header, rows);
}
