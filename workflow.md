# Workflow Pembuatan LightScope — Analisis Intensitas Cahaya

> **Proyek:** [Light_Intensity_Analyzer](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer)
> **Dibuat:** 5 Juli 2026
> **Stack:** Svelte 5 + Vite 8 + Vanilla CSS + Browser Native APIs

---

## Gambaran Umum

**LightScope** adalah aplikasi web SPA (Single-Page Application) berbasis browser untuk menganalisis distribusi intensitas cahaya secara real-time. Aplikasi mendukung tiga sumber input: **kamera live**, **gambar statis**, dan **simulator fisika difraksi Fraunhofer**.

---

## Tahap 1 — Perencanaan & Arsitektur

### 1.1 Identifikasi Kebutuhan Fungsional

Sebelum menulis satu baris kode, tentukan terlebih dahulu apa yang harus bisa dilakukan aplikasi:

| Fitur | Deskripsi |
|---|---|
| Analisis kamera live | Ambil stream video dari `MediaDevices`, ekstrak intensitas per frame |
| Analisis gambar statis | Upload foto, hitung profil luminansi dari gambar diam |
| Simulator fisika | Hitung pola difraksi Fraunhofer dan render secara real-time |
| Visualisasi grafik | Plot profil intensitas 1D dengan peak detection otomatis |
| Klasifikasi pola | Deteksi otomatis: Single Slit, Double Slit, Diffraction Grating |
| Laser Vision | Rekonstruksi visual 1D→2D dengan efek berkas laser realistis |
| Export | Download grafik sebagai PNG |

### 1.2 Keputusan Arsitektur

```
Keputusan:  Svelte 5 (bukan React/Vue)
Alasan:     Reactive stores native, zero runtime overhead,
            kompilasi ke vanilla JS murni — ideal untuk app
            berbasis loop rendering (requestAnimationFrame)

Keputusan:  Vite sebagai bundler
Alasan:     Hot Module Replacement (HMR) cepat, native ESM,
            tidak perlu konfigurasi webpack yang rumit

Keputusan:  Zero library eksternal
Alasan:     Semua komputasi (FFT, fisika, rendering) murni JS browser.
            Tidak ada Chart.js, Three.js, atau library matematika pihak ketiga.
            Hasil: bundle sangat kecil, offline-ready
```

### 1.3 Struktur Komponen yang Direncanakan

```
App.svelte               ← Root: layout & routing visual
├── CameraView.svelte    ← Akuisisi data & rendering overlay
├── Simulator.svelte     ← Mesin fisika difraksi
├── LuminanceChart.svelte← Plotting, peak detection, klasifikasi
└── ControlPanel.svelte  ← Semua input parameter pengguna
```

### 1.4 Desain Alur Data (Unidirectional)

```
[Input Source] ──────────────────────────────────────────────────────┐
  camera / image / simulator                                          │
       ↓                                                              │
[CameraView / Simulator]                                              │
  → Hitung intensityData[]  ─────── tulis ke store ──────────────────┤
                                                                      │
[LuminanceChart]                                                      │
  ← baca intensityData[]   ─────── baca dari store ─────────────────-┘
  → Preprocessing → Plotting → Peak Detection → Klasifikasi
```

**Prinsip kunci:** Semua komponen berkomunikasi via **Svelte writable stores** — tidak ada props drilling, tidak ada event bubbling yang kompleks.

---

## Tahap 2 — Setup Proyek

### 2.1 Inisialisasi dengan Vite + Svelte Template

```bash
# Buat proyek baru
npm create vite@latest light-intensity-analyzer -- --template svelte

# Masuk ke direktori
cd light-intensity-analyzer

# Install dependencies
npm install
```

Hasil struktur awal dari template:
```
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── App.svelte
│   └── lib/
│       └── Counter.svelte  ← hapus ini, ganti dengan komponen kustom
```

### 2.2 Konfigurasi `package.json`

```json
{
  "name": "light-intensity-analyzer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^7.0.0",
    "svelte": "^5.55.1",
    "vite": "^8.0.4"
  }
}
```

> [!NOTE]
> Tidak ada `dependencies` (runtime) — hanya `devDependencies` karena Svelte dikompilasi saat build, bukan dijalankan di runtime browser.

### 2.3 Konfigurasi `vite.config.js`

```javascript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
})
```

Minimal — Vite sudah cukup cerdas untuk tidak memerlukan konfigurasi tambahan.

### 2.4 Setup `index.html` — Entry Point & SEO

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="Analisis distribusi intensitas cahaya secara real-time..." />
    <meta name="theme-color" content="#0f0f13" />
    <title>LightScope — Analisis Intensitas Cahaya</title>

    <!-- Google Fonts: Inter (sans) + JetBrains Mono (mono) -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700
      &family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

**Keputusan desain:**
- `lang="id"` — konten dalam Bahasa Indonesia
- `viewport-fit=cover` — support iPhone notch/Dynamic Island
- `theme-color` — warna status bar browser pada mobile
- Font CDN di `<head>` untuk preload optimal

---

## Tahap 3 — Design System (app.css)

**Prinsip:** Buat token desain dulu sebelum komponen apapun. Semua warna, tipografi, jarak, dan shadow didefinisikan sebagai CSS Custom Properties di `:root`.

### 3.1 Palette Warna

```css
:root {
  /* Background layers (dari terdalam ke terang) */
  --bg:            #0a0a0f;   /* Base — deep space black */
  --bg-elevated:   #111118;   /* Elevated surface */
  --panel-bg:      #16161f;   /* Panel background */
  --panel-bg-alt:  #1c1c28;   /* Alternate panel */
  --surface:       #1f1f2e;   /* Card surface */
  --border:        #252535;   /* Default border */
  --border-light:  #303048;   /* Lighter border */

  /* Text hierarchy */
  --text:          #e8e8f0;   /* Primary text */
  --text-sub:      #a0a0b8;   /* Secondary text */
  --text-muted:    #5c5c78;   /* Muted/disabled */

  /* Accent colors */
  --accent:        #7c6af7;   /* Indigo/violet — primary */
  --accent-2:      #f7506a;   /* Rose red — secondary */
  --green:         #2ecc87;   /* Active/success */
  --yellow:        #f7c948;   /* Warning */
  --danger:        #f7506a;   /* Error/stop */
}
```

**Alasan pilihan palette:**
- Dark mode sebagai default — cocok untuk aplikasi sains di lab
- Indigo (`#7c6af7`) sebagai aksen utama — terlihat di atas latar gelap
- Rose red (`#f7506a`) sebagai aksen bahaya — intuitif secara UX

### 3.2 Tipografi

```css
:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace;
}
```

### 3.3 Global Reset & Base

```css
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent; /* hilangkan flash tap di mobile */
}

body {
  margin: 0;
  font-family: var(--font-sans);
  user-select: none;               /* cegah highlight teks saat drag ROI */
  padding-top: env(safe-area-inset-top);    /* safe area iPhone */
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Tahap 4 — State Management (store.js)

**Buat store sebelum komponen** — ini adalah kontrak antara semua bagian aplikasi.

File: [`src/lib/store.js`](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer/src/lib/store.js)

```javascript
import { writable } from 'svelte/store';

// ── Kontrol Utama ───────────────────────────────────────
export const isAnalyzing      = writable(false);

// ── Sumber Video ────────────────────────────────────────
// 'camera' | 'image' | 'simulation'
export const videoSourceMode  = writable('camera');
export const cameraDevices    = writable([]);
export const selectedDeviceId = writable('');
export const uploadedImage    = writable(null);
export const isFrozen         = writable(false);

// ── Mode Region of Interest (ROI) ───────────────────────
// 'band' | 'center' | 'manual'
export const roiMode          = writable('band');
export const bandHeightPercent= writable(100);

// ── Opsi Kamera ─────────────────────────────────────────
export const mirrorVideo      = writable(false);
export const lockExposure     = writable(false);

// ── Parameter Simulator Fisika ──────────────────────────
export const simType          = writable('single');  // 'single'|'double'|'grating'
export const simWavelength    = writable(650);       // nm
export const simSlitWidth     = writable(0.1);       // mm
export const simSlitDistance  = writable(0.5);       // mm
export const simSlitCount     = writable(10);        // jumlah celah N
export const simScreenDistance= writable(1000);      // mm
export const simZoom          = writable(1);

// ── Output Data ─────────────────────────────────────────
// Array float — luminansi per kolom piksel [0..255]
export const intensityData    = writable([]);
```

**Keputusan desain:**
- `writable` (bukan `readable` atau `derived`) — semua store dapat diubah dari komponen manapun
- Tidak ada store yang bergantung pada store lain (no `derived`) — sederhana, mudah di-debug
- `intensityData` adalah satu-satunya "output bus" — semua sumber menulis ke sini, `LuminanceChart` membaca dari sini

---

## Tahap 5 — Komponen CameraView.svelte

File: [`src/lib/components/CameraView.svelte`](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer/src/lib/components/CameraView.svelte)

**Tanggung jawab:** Mengakuisisi frame dari sumber input, mengekstrak profil intensitas, dan merendernya ke canvas.

### 5.1 Inisialisasi & Lifecycle

```javascript
// onMount: setup canvas contexts + enumerate kamera
onMount(() => {
  getDevices();
  hiddenCtx  = hiddenCanvas.getContext('2d', { willReadFrequently: true });
  //                                           ^─ Optimasi: hint ke GPU bahwa
  //                                              kita sering read back pixel
  overlayCtx = overlayCanvas.getContext('2d');
  laserCtx   = laserCanvas.getContext('2d');
});

// onDestroy: bersihkan stream agar tidak memory leak
onDestroy(() => stopAnalysis());
```

### 5.2 Akuisisi Kamera (WebRTC MediaDevices API)

```javascript
async function getDevices() {
  // 1. Minta izin sekali — browser butuh permission sebelum enumerate
  const initStream = await navigator.mediaDevices.getUserMedia({ video: true });
  initStream.getTracks().forEach(t => t.stop()); // langsung stop, ini hanya untuk izin

  // 2. Enumerate semua video input
  const devices = await navigator.mediaDevices.enumerateDevices();
  $cameraDevices = devices.filter(d => d.kind === 'videoinput');
}

async function startAnalysis() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: $selectedDeviceId },
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  });
  videoElement.srcObject = stream;
  await videoElement.play();
  loop(); // mulai render loop
}
```

### 5.3 Main Render Loop (requestAnimationFrame)

```javascript
function loop() {
  if (!$isAnalyzing) return;

  // 1. Draw source ke hidden canvas (off-screen)
  hiddenCtx.drawImage(sourceEl, 0, 0, vw, vh);

  // 2. Handle mirror
  if ($mirrorVideo) {
    hiddenCtx.translate(vw, 0);
    hiddenCtx.scale(-1, 1);
  }

  // 3. Render ROI overlay
  drawROIOverlay(); // band / center / manual

  // 4. Ekstrak pixel data dari ROI
  imgData = hiddenCtx.getImageData(extractX, extractY, safeW, safeH);

  // 5. Hitung luminansi per kolom (MAX-projection)
  computeLuminance(imgData);

  // 6. (Opsional) Render Laser Vision
  if (laserVision) renderLaserVision();

  animationFrameId = requestAnimationFrame(loop); // ← kunci loop
}
```

### 5.4 Algoritma Ekstraksi Intensitas

**Formula ITU-R BT.601 (Luminance dari RGB):**

```javascript
// Untuk setiap piksel dalam ROI:
let luminance = (data[i]*299 + data[i+1]*587 + data[i+2]*114) / 1000;
//                R×0.299         G×0.587         B×0.114
```

**Koefisien berdasarkan sensitivitas mata manusia:**
- Hijau mendominasi (0.587) — mata paling sensitif terhadap hijau
- Merah menengah (0.299)
- Biru terendah (0.114)

**MAX-Projection (bukan rata-rata):**

```javascript
// Untuk setiap kolom x, ambil luminansi TERTINGGI dari semua baris
if (luminance > newIntensity[x]) newIntensity[x] = luminance;
```

**Mengapa MAX bukan MEAN?**
- Mean akan melemahkan puncak jika ada banyak baris gelap
- MAX memastikan puncak tajam tetap terlihat berapapun tinggi band yang dipilih
- Analog dengan Maximum Intensity Projection (MIP) pada CT-scan medis

### 5.5 Mode ROI (Region of Interest)

| Mode | Cara Kerja | Kapan Digunakan |
|---|---|---|
| **Band** | Horizontal slice di tengah, tinggi adjustable `bandHeightPercent%` | Default — paling fleksibel |
| **Center Line** | Satu baris piksel di tengah persis (`extractH = 1`) | Presisi tinggi, noise rendah |
| **Manual Box** | Drag bounding box bebas dengan mouse/touch | Saat ROI tidak di tengah gambar |

### 5.6 Laser Vision (Fitur Eksklusif)

Merekonstruksi data 1D (`intensityData[]`) menjadi visualisasi 2D berpenampilan laser:

```javascript
// Step 1: Power law contrast boost
let I = Math.pow(val, 2.5); // suppress noise, tajamkan puncak

// Step 2: Gaussian beam profile vertikal (TEM₀₀ mode)
const envLUT[yi] = Math.exp(-dy * dy * 2.5);

// Step 3: Speckle multiplicative noise (dari pre-computed LUT)
const spk = SPECKLE[((x * 107) + (yi * 17)) % 2048];

// Step 4: Additive bloom (inti jadi putih saat saturasi)
const al = I * envLUT[yi] * spk;
// Saat al > 0.5: G dan B meningkat nonlinear → efek putih panas
```

---

## Tahap 6 — Komponen Simulator.svelte

File: [`src/lib/components/Simulator.svelte`](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer/src/lib/components/Simulator.svelte)

**Tanggung jawab:** Mensimulasikan pola difraksi Fraunhofer dan menghasilkan `intensityData[]` sintetis.

### 6.1 Formula Fisika yang Diimplementasikan

#### A. Celah Tunggal (Single Slit)
$$I(\theta) = I_0 \left[\frac{\sin(\beta)}{\beta}\right]^2, \quad \beta = \frac{\pi a \sin\theta}{\lambda}$$

```javascript
intensity = sincSq(beta);  // sinc²(β)
```

#### B. Celah Ganda Young (Double Slit)
$$I(\theta) = I_0 \left[\frac{\sin(\beta)}{\beta}\right]^2 \cos^2(\alpha), \quad \alpha = \frac{\pi d \sin\theta}{\lambda}$$

```javascript
intensity = sincSq(beta) * Math.pow(Math.cos(alpha), 2);
```

#### C. Kisi Difraksi (Diffraction Grating) — N Celah
$$I(\theta) = I_0 \left[\frac{\sin(\beta)}{\beta}\right]^2 \left[\frac{\sin(N\alpha)}{N\sin(\alpha)}\right]^2$$

```javascript
intensity = sincSq(beta) * Math.pow(Math.sin(N * alpha) / sinA, 2) / Math.pow(N, 2);
```

### 6.2 Konversi Satuan (Penting!)

```javascript
const lambda = $simWavelength * 1e-6; // nm → mm
// Input: 650 nm
// Setelah konversi: 0.00065 mm
// Konsisten dengan parameter a, d, L yang dalam mm
```

### 6.3 Rendering Realistis

Menggunakan **offscreen canvas** + **ImageData manipulation** untuk performa maksimum:

```javascript
// Offscreen canvas menghindari DPR mapping bug pada putImageData
const offCanvas = document.createElement('canvas');
offCanvas.width = plotW;
offCanvas.height = plotH;
const offCtx = offCanvas.getContext('2d');

// Manipulasi langsung pixel array (RGBA)
const imgDataOut = offCtx.getImageData(0, 0, plotW, plotH);
const pxData = imgDataOut.data;  // Uint8ClampedArray

// Tulis pixel → putImageData → drawImage (hardware-accelerated)
offCtx.putImageData(imgDataOut, 0, 0);
ctx.drawImage(offCanvas, marginLeft, marginTop, plotW, plotH);
```

---

## Tahap 7 — Komponen LuminanceChart.svelte

File: [`src/lib/components/LuminanceChart.svelte`](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer/src/lib/components/LuminanceChart.svelte)

**Tanggung jawab:** Memvisualisasikan `intensityData[]` sebagai grafik ilmiah, mendeteksi puncak, dan mengklasifikasikan pola difraksi.

### 7.1 Pipeline Preprocessing Data

```
intensityData[]
    │
    ▼ Step 1: Baseline Subtraction (Dark Current Correction)
    │  floor = percentile ke-5 dari distribusi
    │  bsData = data.map(v => max(0, v - floor))
    │
    ▼ Step 2: Smoothed Y-axis (EMA)
    │  smoothedMax = 0.995 * smoothedMax + 0.005 * bsMax
    │  (naik langsung jika peak baru lebih tinggi)
    │
    ▼ Step 3: Max-Pooling untuk rendering
    │  Jika data points > lebar canvas: bin + ambil MAX per bin
    │
    ▼ Step 4: Plot ke Canvas 2D
```

**Mengapa Persentil ke-5 (bukan minimum)?**
- Minimum rentan terhadap dead pixel atau artifak sensor
- Persentil ke-5 lebih robust — hanya 5% terbawah yang dianggap noise floor
- Analog dengan koreksi dark current pada sensor CCD/CMOS profesional

### 7.2 Peak Detection Algorithm

```javascript
function findPeaks(arr, windowSize = 12, thresholdFraction = 0.04) {
  const maxVal = Math.max(...arr, 1);
  const absThreshold = maxVal * 0.04; // hanya peak > 4% dari maksimum global

  for (let i = windowSize; i < arr.length - windowSize; i++) {
    const val = arr[i];
    if (val < absThreshold) continue; // skip noise

    // Cek: apakah ini maximum lokal dalam window ±12?
    let isMax = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j !== i && arr[j] > val) { isMax = false; break; }
    }

    // Merge peak berdekatan: pilih yang tertinggi
    if (peaks.length > 0 && (i - peaks[peaks.length-1].index) <= windowSize) {
      if (val > peaks[peaks.length-1].value) peaks[peaks.length-1] = { index: i, value: val };
    } else {
      peaks.push({ index: i, value: val });
    }
  }
  return peaks;
}
```

### 7.3 Klasifikasi Pola Difraksi

```javascript
function classifyDiffraction(data, peaks, len) {
  const n = peaks.length;

  if (n === 1) return 'Single Slit';

  // Hitung dominansi puncak sentral
  const centralPeak = peaks.reduce((best, p) =>
    Math.abs(p.index - len/2) < Math.abs(best.index - len/2) ? p : best
  , peaks[0]);
  const centralDominance = centralPeak.value / maxVal;

  if (n <= 5 && centralDominance > 0.75) return 'Single Slit';
  if (n > 5) return 'Diffraction Grating';
  return 'Double Slit';
}
```

| Kondisi | Hasil | Dasar Fisika |
|---|---|---|
| 1 puncak | Single Slit | Pola sinc² — hanya 1 maksimum sentral |
| ≤5 puncak, sentral dominan >75% | Single Slit | sinc² dengan secondary maxima lemah |
| 2–5 puncak, sentral tidak dominan | Double Slit | Modulasi cos² menciptakan puncak ganda |
| >5 puncak | Diffraction Grating | N celah menghasilkan banyak orde tajam |

### 7.4 Export PNG

```javascript
function downloadPNG() {
  const link = document.createElement('a');
  link.download = `LightScope-Luminance-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click(); // trigger download browser
}
```

---

## Tahap 8 — Komponen ControlPanel.svelte

File: [`src/lib/components/ControlPanel.svelte`](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer/src/lib/components/ControlPanel.svelte)

**Tanggung jawab:** Semua input pengguna — tab switching, slider, toggle, upload gambar, dan tombol start/stop.

### 8.1 Tab Source Switching

```svelte
<div class="source-tabs">
  <button class:active={$videoSourceMode === 'camera'}
          on:click={() => $videoSourceMode = 'camera'}>Kamera</button>
  <button class:active={$videoSourceMode === 'image'}
          on:click={() => $videoSourceMode = 'image'}>Gambar</button>
  <button class:active={$videoSourceMode === 'simulation'}
          on:click={() => $videoSourceMode = 'simulation'}>Simulasi</button>
</div>
```

Mengubah `$videoSourceMode` store otomatis memicu reaktivitas di semua komponen yang subscribe.

### 8.2 Upload Gambar

```javascript
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    // Bersihkan Object URL lama untuk mencegah memory leak
    if ($uploadedImage) URL.revokeObjectURL($uploadedImage);

    $uploadedImage = URL.createObjectURL(file);

    // Auto-start analisis saat gambar di-upload
    if (!$isAnalyzing) $isAnalyzing = true;
  }
}
```

### 8.3 Parameter Simulator (Conditional Rendering)

```svelte
<!-- Jarak celah hanya muncul untuk double/grating -->
{#if $simType === 'double' || $simType === 'grating'}
  <input type="range" bind:value={$simSlitDistance} />
{/if}

<!-- Jumlah celah hanya untuk grating -->
{#if $simType === 'grating'}
  <input type="range" bind:value={$simSlitCount} />
{/if}
```

---

## Tahap 9 — Komponen Root App.svelte

File: [`src/App.svelte`](file:///c:/Users/Yusuf/Documents/Github/Light_Intensity_Analyzer/src/App.svelte)

### 9.1 Layout Responsif

```svelte
<div class="app-layout">
  <!-- Kolom kiri/atas: visual -->
  <div class="visual-column">
    <header class="app-header">...</header>
    <div class="camera-section">
      {#if $videoSourceMode === 'simulation'}
        <Simulator />
      {:else}
        <CameraView />
      {/if}
    </div>
    <div class="chart-section">
      <LuminanceChart />
    </div>
  </div>

  <!-- Kolom kanan/bawah: kontrol -->
  <aside class="control-column">
    <ControlPanel />
  </aside>
</div>
```

### 9.2 Strategi Responsive Layout

```css
/* Mobile: satu kolom, bisa scroll */
.app-layout {
  display: flex;
  flex-direction: column;
}

/* Desktop ≥768px: dua kolom, full height locked */
@media (min-width: 768px) {
  .app-layout {
    flex-direction: row;
    height: 100vh;
    overflow: hidden;
  }

  .control-column {
    width: 300px;
    border-left: 1px solid var(--border);
    overflow-y: auto;  /* kontrol bisa scroll sendiri */
  }
}
```

---

## Tahap 10 — Optimasi Performa

Semua teknik optimasi yang diterapkan:

| Teknik | Implementasi | Tujuan |
|---|---|---|
| `requestAnimationFrame` | Loop utama semua komponen | Sinkronisasi dengan refresh rate monitor (60/120fps) |
| `willReadFrequently: true` | Hidden canvas context | Hint ke GPU bahwa `getImageData()` dipanggil sering |
| Offscreen Canvas | Simulator rendering | Hindari DPR mapping bug pada `putImageData` |
| Pre-computed Speckle LUT | `Float32Array(2048)` lazily init | Hindari `Math.random()` per frame (60fps × ribuan piksel) |
| Pre-computed Gaussian LUT | `envLUT[yi]` per frame | Hindari `Math.exp()` per piksel saat render laser |
| Max-Pooling | Chart rendering | Preservasi puncak saat downsampling ke lebar canvas |
| EMA Smoothing | Y-axis scale | Stabilisasi skala tanpa jitter saat intensitas fluktuasi |
| Early continue | `if (al < 0.01) continue` | Skip piksel transparan penuh — hemat ~80% iterasi |

---

## Tahap 11 — Micro-Animations & UX Polish

### 11.1 Animasi yang Diimplementasikan

| Nama | Komponen | Efek | CSS |
|---|---|---|---|
| `pulse` | Status dot header | Berkedip hijau saat analisis aktif | `@keyframes pulse` |
| `pulseFrozen` | Tombol freeze | Ring merah berdenyut | `@keyframes pulseFrozen` |
| `laserPulse` | Tombol laser | Glow merah bergelombang | `@keyframes laserPulse` |
| `dangerPulse` | Tombol stop | Ring bahaya berdenyut | `@keyframes dangerPulse` |
| Glow phase | ROI overlay border | Border berdenyut saat analisis (`sin` wave) | JavaScript per frame |

### 11.2 Interactive States

```css
/* Semua button punya 3 state */
button          { /* default */ }
button:hover    { background: var(--panel-bg-alt); }
button:active   { transform: scale(0.97); } /* haptic feedback visual */
```

---

## Tahap 12 — Testing & Verifikasi

### 12.1 Checklist Fungsional

```
[ ] Kamera live berjalan dan stream terdeteksi
[ ] Profil intensitas bergerak sesuai perubahan cahaya di kamera
[ ] Upload gambar → analisis otomatis dimulai
[ ] Mode Band / Center / Manual berkerja dengan benar
[ ] Slider band height mengubah ROI secara real-time
[ ] Mirror video bekerja
[ ] Simulator: Single Slit menghasilkan pola sinc²
[ ] Simulator: Double Slit menghasilkan pola dengan modulasi cos²
[ ] Simulator: Grating menghasilkan puncak tajam lebih banyak saat N meningkat
[ ] Slider wavelength mengubah warna laser di simulator
[ ] Peak detection menandai puncak di grafik
[ ] Klasifikasi badge tampil (Single/Double/Grating)
[ ] Export PNG berhasil didownload
[ ] Laser Vision toggle bekerja dan menampilkan visualisasi
[ ] Freeze frame bekerja
[ ] Layout responsif di mobile (<768px)
[ ] Layout responsif di desktop (≥768px)
```

### 12.2 Jalankan Dev Server

```bash
npm run dev
# Output: http://localhost:5173
```

### 12.3 Build Produksi

```bash
npm run build
# Output: dist/

npm run preview
# Preview build produksi di localhost:4173
```

---

## Rangkuman Urutan Pembuatan

```
1. Perencanaan Arsitektur     → tentukan komponen & alur data
2. Setup Proyek (npm/vite)    → scaffold template Svelte
3. index.html                 → SEO, font, meta tags
4. app.css (Design System)    → token warna, tipografi, reset
5. store.js                   → semua reactive state
6. CameraView.svelte          → akuisisi, ROI, loop rendering
7. Simulator.svelte           → fisika difraksi, laser rendering
8. LuminanceChart.svelte      → grafik, peak detection, klasifikasi
9. ControlPanel.svelte        → semua input UI
10. App.svelte (Root)         → layout, routing visual
11. Optimasi performa         → LUT, offscreen canvas, EMA
12. Polish animasi & UX       → micro-animations, hover states
13. Testing & verifikasi      → checklist fungsional
```

---

## Referensi Teori yang Diimplementasikan

| # | Teori | Referensi | Dipakai di |
|---|---|---|---|
| 1 | **ITU-R BT.601 Luminance** | International Telecommunication Union | `CameraView.svelte` — konversi RGB→grayscale |
| 2 | **Difraksi Fraunhofer — Celah Tunggal** | Hecht, *Optics* §10.2 | `Simulator.svelte` — formula `sinc²(β)` |
| 3 | **Difraksi Young — Celah Ganda** | Young (1801); Jenkins & White §17.2 | `Simulator.svelte` — `sinc²·cos²` |
| 4 | **Kisi Difraksi** | Born & Wolf, *Principles of Optics* §8.6 | `Simulator.svelte` — faktor N-celah |
| 5 | **Distribusi Speckle Laser (Rayleigh)** | Goodman, *Speckle Phenomena in Optics* | `Simulator.svelte`, `CameraView.svelte` |
| 6 | **Berkas Gaussian (TEM₀₀)** | Saleh & Teich, *Fundamentals of Photonics* | Laser Vision — `exp(-dy²·2.5)` |
| 7 | **Maximum Intensity Projection** | Teknik CT/MRI medis | `CameraView.svelte` — MAX-projection |
| 8 | **Koreksi Dark Current** | Standar fotometri CCD | `LuminanceChart.svelte` — persentil ke-5 |
| 9 | **Exponential Moving Average** | Statistik time-series | `LuminanceChart.svelte` — skala Y |
| 10 | **Local Maxima Detection** | Algoritma pemrosesan sinyal | `LuminanceChart.svelte` — sliding window |

---

*Dokumen ini dibuat berdasarkan analisis lengkap kode sumber oleh Antigravity AI — 5 Juli 2026.*
