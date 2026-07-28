<script>
  import { onMount, onDestroy } from 'svelte';
  import { intensityData, isAnalyzing, videoSourceMode,
           physFrameWidthCm, enableMeasurement, liveInterference } from '../store.js';

  let canvas;
  let ctx;
  let animationFrameId;
  let patternLabel = '';
  let patternColor = '#4a90e2';
  let maxPeakDisplay = 0;
  let peaksCountDisplay = 0;
  // Smoothed max for stable Y-axis (prevents jumpiness)
  let smoothedMax = 1;

  onMount(() => {
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    window.addEventListener('resize', resize);
    loop();
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  function resize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
  }

  function loop() {
    if (!$isAnalyzing || $intensityData.length === 0) {
      if (ctx && canvas) {
        clearCanvas();
        drawStandby();
        patternLabel = '';
        peaksCountDisplay = 0;
        maxPeakDisplay = 0;
      }
    } else {
      drawChart();
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function clearCanvas() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);
  }

  function drawStandby() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const mL = 40, mB = 30, mT = 40, mR = 20;
    drawAxesAndGrid(w, h, mL, mB, mT, mR, 255, 7);
    ctx.fillStyle = '#888888';
    ctx.font = '14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— Menunggu sinyal —', w / 2, h / 2);
  }

  function drawAxesAndGrid(w, h, mL, mB, mT, mR, yMax, ySteps) {
    const plotW = w - mL - mR;
    const plotH = h - mT - mB;

    // ── Background (Light Theme like reference) ─────────────────
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);

    // Plot area background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mL, mT, plotW, plotH);

    // ── Grid lines ───────────────────────────────────────────────
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // Horizontal grid (Y)
    for (let i = 0; i <= ySteps; i++) {
      const y = mT + (plotH / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(mL + plotW, y);
      ctx.stroke();
    }
    
    // Vertical grid (X)
    const xDivs = 9; 
    for (let i = 0; i <= xDivs; i++) {
      const x = mL + (plotW / xDivs) * i;
      ctx.beginPath();
      ctx.moveTo(x, mT);
      ctx.lineTo(x, mT + plotH);
      ctx.stroke();
    }

    // ── Border ───────────────────────────────────────────────────
    ctx.strokeStyle = '#ced4da';
    ctx.lineWidth = 1;
    ctx.strokeRect(mL, mT, plotW, plotH);

    // ── Y-axis ticks & labels ────────────────────────────────────
    ctx.fillStyle = '#495057';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= ySteps; i++) {
      const frac = 1 - i / ySteps;
      const y = mT + (plotH / ySteps) * i;
      const val = frac * yMax;
      ctx.fillText(val >= 10 ? val.toFixed(0) : val.toFixed(1), mL - 8, y);
    }

    return { plotW, plotH };
  }

  function drawChart() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const data = $intensityData;
    const len = data.length;
    if (len === 0) return;

    const mL = 40, mB = 30, mT = 40, mR = 20;

    // ──────────────────────────────────────────────────────────
    // STRICT SCIENTIFIC DATA PIPELINE (RAW DATA, NO FAKE GAMMA)
    // 1. Baseline subtraction (Dark current noise floor removal)
    const sorted5 = [...data].sort((a, b) => a - b);
    const floor   = sorted5[Math.floor(sorted5.length * 0.05)] || 0;
    const bsData  = data.map(v => Math.max(0, v - floor)); 

    // 2. No Gamma smoothing - we plot the pure raw intensity
    const bsMax   = Math.max(...bsData, 1);
    const dispData = bsData; 

    // 3. Smoothed Y-axis scale for readability
    if (bsMax > smoothedMax) {
      smoothedMax = bsMax;
    } else {
      smoothedMax = smoothedMax * 0.995 + bsMax * 0.005;
    }
    const yMax = Math.max(smoothedMax * 1.05, 1); // 5% headroom
    // ──────────────────────────────────────────────────────────

    const ySteps = 7;
    const { plotW, plotH } = drawAxesAndGrid(w, h, mL, mB, mT, mR, yMax, ySteps);

    // ── X-axis labels ────────────────────────────────────────────
    const xDivs = 9;
    ctx.fillStyle = '#495057';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xDivs; i++) {
      const xi = mL + (plotW / xDivs) * i;
      const xVal = Math.round((i / xDivs) * len);
      ctx.fillText(xVal, xi, mT + plotH + 8);
    }

    // ── Legend (Top Center as in reference) ──────────────────────
    const legW = 140;
    const legX = mL + plotW / 2 - legW / 2;
    const legY = mT - 25;
    
    // Light blue box
    ctx.fillStyle = '#90caf9';
    ctx.fillRect(legX, legY, 32, 12);
    ctx.strokeStyle = '#5fa2ce';
    ctx.lineWidth = 1;
    ctx.strokeRect(legX, legY, 32, 12);
    
    ctx.fillStyle = '#495057';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('Intensitas (luminance)', legX + 40, legY + 6);

    // ── Build plot points (MAX-POOLING for scientific accuracy) ──
    let points = [];
    if (len > plotW) {
      const step = len / plotW;
      for (let x = 0; x < plotW; x++) {
        const i0 = Math.floor(x * step);
        const i1 = Math.min(len - 1, Math.ceil((x + 1) * step));
        let peak = 0;
        for (let k = i0; k <= i1; k++) peak = Math.max(peak, dispData[k]);
        points.push({ x: mL + x, y: mT + plotH - (peak / yMax) * plotH });
      }
    } else {
      for (let i = 0; i < len; i++) {
        const xp = mL + (i / (len - 1)) * plotW;
        points.push({ x: xp, y: mT + plotH - (dispData[i] / yMax) * plotH });
      }
    }
    if (points.length === 0) return;

    // ── Plot line (Solid, crisp, NO fill under curve) ────────────
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = '#5fa2ce'; // Muted scientific blue
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // ── Peak detection (Subtle, professional annotations) ────────
    const peaks = findPeaks(bsData, 12, 0.04); 
    
    peaks.forEach((p, idx) => {
      const px  = mL + (p.index / (len - 1)) * plotW;
      const dispVal = dispData[p.index] ?? 0;
      const py  = mT + plotH - (dispVal / yMax) * plotH;

      // Small tick mark on the peak
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py - 3);
      ctx.lineTo(px, py - 8);
      ctx.stroke();

      // Simple black text above
      ctx.fillStyle = '#212529';
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`p${idx+1}`, px, py - 10);
    });

    if (peaks.length > 0) {
      maxPeakDisplay = Math.max(...peaks.map(p => p.value));
      peaksCountDisplay = peaks.length;
    } else {
      maxPeakDisplay = 0;
      peaksCountDisplay = 0;
    }

    if ($videoSourceMode !== 'simulation' && peaks.length >= 1) {
      const r = classifyDiffraction(bsData, peaks, len);
      patternLabel = r.label;
      patternColor = r.color;
    } else if ($videoSourceMode === 'simulation') {
      patternLabel = '';
    }

    // ── Interferometry Measurement ──────────────────────────────────────────
    if ($enableMeasurement && $videoSourceMode !== 'simulation') {
      if (peaks.length >= 1) {
        // Central peak = peak dengan nilai luminance tertinggi
        const centralPeak = peaks.reduce((best, p) => p.value > best.value ? p : best, peaks[0]);

        // Cari puncak pertama di kanan dan kiri dari central peak
        const rightPeaks = peaks
          .filter(p => p.index > centralPeak.index)
          .sort((a, b) => a.index - b.index);
        const leftPeaks  = peaks
          .filter(p => p.index < centralPeak.index)
          .sort((a, b) => b.index - a.index);

        const xPlusPeak  = rightPeaks[0] ?? null;
        const xMinusPeak = leftPeaks[0]  ?? null;

        // Konversi: 1 pixel data = physFrameWidthCm / len  cm
        const cmPerPx   = $physFrameWidthCm / len;
        const xPlusVal  = xPlusPeak  ? (xPlusPeak.index  - centralPeak.index) * cmPerPx  : null;
        const xMinusVal = xMinusPeak ? -((centralPeak.index - xMinusPeak.index) * cmPerPx) : null;
        const Pval = (xPlusVal !== null && xMinusVal !== null)
          ? (Math.abs(xPlusVal) + Math.abs(xMinusVal)) / 2
          : null;

        // Update live store
        liveInterference.set({
          I:      +dispData[centralPeak.index].toFixed(1),
          xPlus:  xPlusVal  !== null ? +xPlusVal.toFixed(2)  : null,
          xMinus: xMinusVal !== null ? +xMinusVal.toFixed(2) : null,
          P:      Pval      !== null ? +Pval.toFixed(2)      : null
        });

        // Helper: konversi index data → koordinat x di canvas
        const idxToX = i => mL + (i / Math.max(len - 1, 1)) * plotW;

        // ── Central peak: garis putus-putus ungu ──
        const cxScr = idxToX(centralPeak.index);
        ctx.save();
        ctx.strokeStyle = 'rgba(157,143,247,0.5)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(cxScr, mT); ctx.lineTo(cxScr, mT + plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle    = '#9d8ff7';
        ctx.font         = '700 8px Arial, sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('I₀', cxScr, mT + 3);
        ctx.restore();

        // ── x(+) peak: garis hijau ──
        if (xPlusPeak && xPlusVal !== null) {
          const sx = idxToX(xPlusPeak.index);
          ctx.save();
          ctx.strokeStyle = 'rgba(46,204,135,0.75)';
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(sx, mT); ctx.lineTo(sx, mT + plotH); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle    = '#2ecc87';
          ctx.font         = '700 8px Arial, sans-serif';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('x(+)', sx, mT + 3);
          ctx.font = '600 8px Arial, sans-serif';
          ctx.fillText(`${xPlusVal.toFixed(2)}cm`, sx, mT + 13);
          ctx.restore();
        }

        // ── x(-) peak: garis merah ──
        if (xMinusPeak && xMinusVal !== null) {
          const sx = idxToX(xMinusPeak.index);
          ctx.save();
          ctx.strokeStyle = 'rgba(247,80,106,0.75)';
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(sx, mT); ctx.lineTo(sx, mT + plotH); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle    = '#f7506a';
          ctx.font         = '700 8px Arial, sans-serif';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('x(-)', sx, mT + 3);
          ctx.font = '600 8px Arial, sans-serif';
          ctx.fillText(`${xMinusVal.toFixed(2)}cm`, sx, mT + 13);
          ctx.restore();
        }

        // ── P bracket antara x(-) dan x(+) ──
        if (xPlusPeak && xMinusPeak && Pval !== null) {
          const sxP = idxToX(xPlusPeak.index);
          const sxM = idxToX(xMinusPeak.index);
          const bY  = mT + plotH - 7;
          ctx.save();
          ctx.strokeStyle = 'rgba(245,166,35,0.65)';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(sxM, bY); ctx.lineTo(sxP, bY);
          ctx.moveTo(sxM, bY - 4); ctx.lineTo(sxM, bY + 4);
          ctx.moveTo(sxP, bY - 4); ctx.lineTo(sxP, bY + 4);
          ctx.stroke();
          ctx.fillStyle    = 'rgba(245,166,35,0.9)';
          ctx.font         = '700 8px Arial, sans-serif';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`P ≈ ${Pval.toFixed(2)} cm`, (sxM + sxP) / 2, bY - 5);
          ctx.restore();
        }

      } else {
        // Tidak ada peak — reset live store
        liveInterference.set({ I: null, xPlus: null, xMinus: null, P: null });
      }
    } else if (!$enableMeasurement) {
      // Pastikan store kosong saat fitur dimatikan
      liveInterference.set({ I: null, xPlus: null, xMinus: null, P: null });
    }
  }

  function findPeaks(arr, windowSize = 12, thresholdFraction = 0.04) {
    const maxVal = Math.max(...arr, 1);
    const absThreshold = maxVal * thresholdFraction;
    const peaks = [];
    for (let i = windowSize; i < arr.length - windowSize; i++) {
      const val = arr[i];
      if (val < absThreshold) continue;
      let isMax = true;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (i !== j && arr[j] > val) { isMax = false; break; }
      }
      if (!isMax) continue;
      if (peaks.length > 0 && (i - peaks[peaks.length - 1].index) <= windowSize) {
        if (val > peaks[peaks.length - 1].value) peaks[peaks.length - 1] = { index: i, value: val };
      } else {
        peaks.push({ index: i, value: val });
      }
    }
    return peaks;
  }

  function classifyDiffraction(data, peaks, len) {
    const n = peaks.length;
    if (n === 1) return { label: 'Single Slit', color: '#f5a623' };
    const maxVal = Math.max(...peaks.map(p => p.value));
    const centerIdx = len / 2;
    const centralPeak = peaks.reduce((best, p) => Math.abs(p.index - centerIdx) < Math.abs(best.index - centerIdx) ? p : best, peaks[0]);
    const centralDominance = centralPeak.value / maxVal;
    
    if (n <= 5 && centralDominance > 0.75) return { label: 'Single Slit', color: '#f5a623' };
    if (n > 5) return { label: 'Diffraction Grating', color: '#417505' };
    return { label: 'Double Slit', color: '#4a90e2' };
  }

  function downloadPNG() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `LightScope-Luminance-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
</script>

<div class="chart-wrapper">
  <div class="chart-header">
    <div class="chart-title">
      Profil Intensitas Cahaya
    </div>

    <div class="header-right">
      {#if peaksCountDisplay > 0}
        <span class="peak-stats">
          Peaks: <strong>{peaksCountDisplay}</strong> | 
          Imax: <strong>{maxPeakDisplay.toFixed(1)}</strong>
        </span>
      {/if}
      {#if patternLabel}
        <span class="pattern-badge">{patternLabel}</span>
      {/if}
      <button class="download-btn" on:click={downloadPNG} title="Download PNG">Export</button>
    </div>
  </div>

  <div class="chart-container">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .chart-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: #ffffff;
    border-radius: 4px;
    border: 1px solid #dee2e6;
    overflow: hidden;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
  }

  .chart-title {
    font-size: 14px;
    font-weight: 600;
    color: #212529;
    font-family: Arial, sans-serif;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .peak-stats {
    font-size: 12px;
    color: #495057;
    font-family: Arial, sans-serif;
  }

  .pattern-badge {
    padding: 3px 8px;
    background: #e9ecef;
    border-radius: 3px;
    font-size: 11px;
    font-weight: bold;
    color: #495057;
    border: 1px solid #ced4da;
    font-family: Arial, sans-serif;
  }

  .download-btn {
    padding: 4px 12px;
    background: #ffffff;
    border: 1px solid #ced4da;
    border-radius: 3px;
    color: #495057;
    font-size: 12px;
    cursor: pointer;
    font-family: Arial, sans-serif;
  }

  .download-btn:hover {
    background: #e9ecef;
  }

  .chart-container {
    flex: 1;
    position: relative;
    width: 100%;
    min-height: 0;
    background: #f8f9fa;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
