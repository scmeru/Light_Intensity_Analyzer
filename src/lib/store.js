import { writable, derived } from 'svelte/store';

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

// ── Interferometry / Diffraction Physics Parameters ─────────────────────────
// Digunakan untuk mengkonversi posisi pixel → satuan fisik (cm)
export const physL             = writable(0.75);   // Jarak kisi ke layar/kamera (m)
export const physLambda        = writable(630);    // Panjang gelombang laser (nm) — dipakai saat menghitung d
export const physFrameWidthCm  = writable(30);     // Lebar frame kamera secara fisik (cm)
export const enableMeasurement = writable(false);  // Toggle aktifkan pengukuran

// ── Diffraction Grating Parameter ───────────────────────────────────────────
// physD: konstanta kisi dalam lines/mm (misalnya 300, 600, 1200 l/mm)
// Mode:
//   'calc_lambda' = d diketahui → hitung λ dari posisi puncak
//   'calc_d'      = λ diketahui → hitung d dari posisi puncak
export const physD           = writable(600);          // lines/mm (default kisi umum 600 l/mm)
export const gratingMode     = writable('calc_lambda'); // 'calc_lambda' | 'calc_d'

// Live measurement result — diperbarui setiap frame saat enableMeasurement aktif
// Sekarang juga menyimpan hasil hitungan λ dan d
export const liveInterference  = writable({
  I:       null,   // Intensitas puncak sentral (luma 0-255)
  xPlus:   null,   // Posisi x(+1) relatif ke pusat (cm)
  xMinus:  null,   // Posisi x(-1) relatif ke pusat (cm)
  P:       null,   // Rata-rata |x±| (cm)
  lambdaCalc: null, // λ terhitung dari rumus kisi (nm) — valid jika gratingMode = 'calc_lambda'
  dCalc:   null,   // d terhitung (µm) — valid jika gratingMode = 'calc_d'
  theta1:  null,   // Sudut orde pertama θ₁ (derajat)
});

// Rekaman hasil pengukuran per sesi
export const interferenceResults = writable([]);

