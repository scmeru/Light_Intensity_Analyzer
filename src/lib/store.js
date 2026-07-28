import { writable } from 'svelte/store';

// App state
export const isAnalyzing = writable(false);
export const cameraDevices = writable([]);
export const selectedDeviceId = writable("");

// Mode source
// 'camera'     = Live Camera (navigator.mediaDevices)
// 'image'      = Static Image Upload
// 'simulation' = Physics Simulator
export const videoSourceMode = writable('camera');
export const uploadedImage = writable(null);
export const isFrozen = writable(false);

// Mode selection for extracting light intensity
// 'band' = horizontal slice profile (full image height by default)
// 'center' = middle horizontal line
// 'manual' = custom bounding box
export const roiMode = writable("band");

export const mirrorVideo = writable(false);
export const lockExposure = writable(false);
export const bandHeightPercent = writable(100); // 100% default = full image

// Physics Simulation State
export const simType = writable('single'); // 'single', 'double', 'grating'
export const simWavelength = writable(650); // nm (visible spectrum ~400-700)
export const simSlitWidth = writable(0.1); // mm
export const simSlitDistance = writable(0.5); // mm (double slit / grating)
export const simSlitCount = writable(10); // Number of slits (grating)
export const simScreenDistance = writable(1000); // mm (1 meter)
export const simZoom = writable(1); // Zoom level for the chart

// Raw plotting data [number, number, ...] representing luminance per column
export const intensityData = writable([]);

// ── Interferometry Physics Parameters ──────────────────────────────────────
// Digunakan untuk mengkonversi posisi pixel → satuan fisik (cm)
export const physL             = writable(0.75);   // Jarak LCD ke layar (m)
export const physLambda        = writable(630);    // Panjang gelombang (nm)
export const physFrameWidthCm  = writable(30);     // Lebar frame kamera secara fisik (cm)
export const enableMeasurement = writable(false);  // Toggle aktifkan pengukuran

// Live measurement result — diperbarui setiap frame saat enableMeasurement aktif
export const liveInterference  = writable({ I: null, xPlus: null, xMinus: null, P: null });

// Rekaman hasil pengukuran per sesi
export const interferenceResults = writable([]);
