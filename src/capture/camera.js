/**
 * Camera Module
 * Handles getUserMedia stream management and frame capture to canvas.
 */

/**
 * Start camera stream on video element.
 * @param {HTMLVideoElement} videoEl
 * @param {string} [facingMode='environment']
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoEl, facingMode = 'environment') {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  } catch (err) {
    console.error('Camera access failed:', err);
    throw err;
  }
}

/**
 * Safely stop all tracks on a MediaStream.
 * @param {MediaStream|null} stream
 */
export function stopCamera(stream) {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
}

/**
 * Freeze video frame to canvas at native video resolution.
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
export function captureFrame(videoEl, canvas) {
  canvas.width = videoEl.videoWidth || 1920;
  canvas.height = videoEl.videoHeight || 1080;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return ctx;
}
