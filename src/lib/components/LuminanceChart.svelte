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

  // ── Dark theme palette ──────────────────────────────────────────
  const C = {
    bg:        '#0d1117',
    plotBg:    '#0d1117',
    grid:      'rgba(255,255,255,0.06)',
    border:    'rgba(255,255,255,0.12)',
    axis:      'rgba(255,255,255,0.45)',
    label:     'rgba(255,255,255,0.70)',
    line:      '#38bdf8',      // bright sky blue line
    lineGlow:  '#38bdf8',
    peakDash:  'rgba(56,189,248,0.35)',
    peakTick:  '#38bdf8',
    peakLabel: '#ffffff',
    orderLabel:'#93c5fd',
    legendBox: '#38bdf8',
    standby:   'rgba(255,255,255,0.35)',
  };

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

  // ── Standby screen ──────────────────────────────────────────────
  function drawStandby() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const mL = 55, mB = 38, mT = 44, mR = 20;
    drawAxesAndGrid(w, h, mL, mB, mT, mR, 255, 6);
    ctx.fillStyle = C.standby;
    ctx.font = '14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— Menunggu sinyal —', w / 2, h / 2);
  }

  // ── Axes + grid (dark theme) ─────────────────────────────────────
  function drawAxesAndGrid(w, h, mL, mB, mT, mR, yMax, ySteps) {
    const plotW = w - mL - mR;
    const plotH = h - mT - mB;

    // Outer bg
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Plot bg
    ctx.fillStyle = C.plotBg;
    ctx.fillRect(mL, mT, plotW, plotH);

    // ── Horizontal grid (Y) ─────────────────────────────────────
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let i = 0; i <= ySteps; i++) {
      const y = mT + (plotH / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(mL + plotW, y);
      ctx.stroke();
    }

    // ── Vertical grid (X) ──────────────────────────────────────
    const xDivs = 9;
    for (let i = 0; i <= xDivs; i++) {
      const x = mL + (plotW / xDivs) * i;
      ctx.beginPath();
      ctx.moveTo(x, mT);
      ctx.lineTo(x, mT + plotH);
      ctx.stroke();
    }

    // ── Plot border ─────────────────────────────────────────────
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(mL, mT, plotW, plotH);

    // ── Y-axis ticks & labels ───────────────────────────────────
    ctx.fillStyle = C.axis;
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= ySteps; i++) {
      const frac = 1 - i / ySteps;
      const y = mT + (plotH / ySteps) * i;
      const val = frac * yMax;
      ctx.fillText(val >= 10 ? val.toFixed(0) : val.toFixed(1), mL - 8, y);
    }

    // ── Y-axis title (rotated) ──────────────────────────────────
    ctx.save();
    ctx.fillStyle = C.label;
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(14, mT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Intensitas (0–255)', 0, 0);
    ctx.restore();

    return { plotW, plotH };
  }

  // ── Main draw ───────────────────────────────────────────────────
  function drawChart() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const data = $intensityData;
    const len = data.length;
    if (len === 0) return;

    const mL = 55, mB = 38, mT = 44, mR = 20;

    // ── DATA PIPELINE ──────────────────────────────────────────
    // 1. Baseline subtraction
    const sorted5 = [...data].sort((a, b) => a - b);
    const floor   = sorted5[Math.floor(sorted5.length * 0.05)] || 0;
    const bsData  = data.map(v => Math.max(0, v - floor));

    // 2. Gaussian smoothing untuk memperhalus grafik
    const dispData = gaussianSmooth(bsData, 8);
    const bsMax    = Math.max(...dispData, 1);

    // 3. Smooth Y-axis scale
    if (bsMax > smoothedMax) {
      smoothedMax = bsMax;
    } else {
      smoothedMax = smoothedMax * 0.995 + bsMax * 0.005;
    }
    const yMax = Math.max(smoothedMax * 1.20, 1);
    // ───────────────────────────────────────────────────────────

    const ySteps = 6;
    const { plotW, plotH } = drawAxesAndGrid(w, h, mL, mB, mT, mR, yMax, ySteps);

    // ── X-axis ticks ────────────────────────────────────────────
    const xDivs = 9;
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    for (let i = 0; i <= xDivs; i++) {
      const xi = mL + (plotW / xDivs) * i;
      ctx.beginPath();
      ctx.moveTo(xi, mT + plotH);
      ctx.lineTo(xi, mT + plotH + 4);
      ctx.stroke();
      // X tick label
      const xVal = $enableMeasurement && $videoSourceMode !== 'simulation'
        ? ($physFrameWidthCm * (i / xDivs)).toFixed(1) + 'cm'
        : Math.round((i / xDivs) * len) + '';
      ctx.fillStyle = C.axis;
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (i > 0 && i < xDivs) ctx.fillText(xVal, xi, mT + plotH + 6);
    }

    // ── X-axis edge labels ───────────────────────────────────────
    {
      const edgeLeft  = $enableMeasurement && $videoSourceMode !== 'simulation' ? '0.0cm' : '0';
      const edgeRight = $enableMeasurement && $videoSourceMode !== 'simulation'
        ? `${$physFrameWidthCm.toFixed(1)}cm`
        : `${len}`;
      ctx.fillStyle = C.axis;
      ctx.font = '10px Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(edgeLeft,  mL, mT + plotH + 6);
      ctx.textAlign = 'right';
      ctx.fillText(edgeRight, mL + plotW, mT + plotH + 6);
    }

    // ── X-axis title ─────────────────────────────────────────────
    ctx.fillStyle = C.label;
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const xAxisLabel = $enableMeasurement && $videoSourceMode !== 'simulation'
      ? 'Posisi (cm)'
      : 'Posisi (px)';
    ctx.fillText(xAxisLabel, mL + plotW / 2, h - 2);

    // ── Legend ───────────────────────────────────────────────────
    const legX = mL + 10;
    const legY = mT - 25;
    // Glow line swatch
    ctx.save();
    ctx.shadowColor = C.lineGlow;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legX, legY + 6);
    ctx.lineTo(legX + 28, legY + 6);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.label;
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Intensitas (luminance)', legX + 36, legY + 6);

    // ── Build plot points ────────────────────────────────────────
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

    // ── Draw glowing line ────────────────────────────────────────
    ctx.save();
    // Outer glow pass (blurred)
    ctx.shadowColor = C.lineGlow;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    // Sharp inner pass (crisp)
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();

    // ── Peak detection ───────────────────────────────────────────
    // Threshold: 8% dari max — cukup tinggi agar puncak tidak terlihat di layar dibuang
    const peaks = findPeaks(dispData, 10, 0.08);

    // Tentukan central peak (nilai tertinggi) untuk menghitung orde m
    let centralIdx = peaks.length > 0
      ? peaks.reduce((best, p) => p.value > best.value ? p : best, peaks[0]).index
      : Math.floor(len / 2);

    // Urutkan berdasarkan posisi untuk penomoran berurutan
    const sortedPeaks = [...peaks].sort((a, b) => a.index - b.index);
    // Temukan indeks central di sortedPeaks
    const centralSorted = sortedPeaks.findIndex(p => p.index === centralIdx);

    // ── Annotate each peak ────────────────────────────────────────
    sortedPeaks.forEach((p, si) => {
      const orderM = si - centralSorted; // m = 0 at center, negative left, positive right
      const px  = mL + (p.index / (len - 1)) * plotW;
      const dispVal = dispData[p.index] ?? 0;
      const py  = mT + plotH - (dispVal / yMax) * plotH;

      // Drop line
      ctx.save();
      ctx.strokeStyle = C.peakDash;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py + 2);
      ctx.lineTo(px, mT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tick at x-axis
      ctx.strokeStyle = C.peakTick;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, mT + plotH);
      ctx.lineTo(px, mT + plotH + 5);
      ctx.stroke();
      ctx.restore();

      // Small tick on peak
      ctx.strokeStyle = C.peakTick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py - 2);
      ctx.lineTo(px, py - 7);
      ctx.stroke();

      // Order label: "m = X"
      const mLabel = `m = ${orderM >= 0 ? '+' + orderM : orderM}`.replace('+-', '-');
      // Remove "m = +0" → "m = 0"
      const mLabelClean = mLabel.replace('m = +0', 'm = 0');
      ctx.fillStyle = C.orderLabel;
      ctx.font = '9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(mLabelClean, px, py - 9);

      // Peak sequence label: "p1", "p2" etc. (below order label)
      ctx.fillStyle = C.peakLabel;
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`p${si + 1}`, px, py - 18);

      // Position label below x-axis
      let xLabel;
      if ($enableMeasurement && $videoSourceMode !== 'simulation') {
        xLabel = `${(p.index * ($physFrameWidthCm / len)).toFixed(1)}cm`;
      } else {
        xLabel = `${p.index}`;
      }
      ctx.fillStyle = C.peakTick;
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(xLabel, px, mT + plotH + 7);
    });

    // ── Update display stats ─────────────────────────────────────
    if (peaks.length > 0) {
      maxPeakDisplay = Math.max(...peaks.map(p => p.value));
      peaksCountDisplay = peaks.length;
    } else {
      maxPeakDisplay = 0;
      peaksCountDisplay = 0;
    }

    // ── Pattern classification ───────────────────────────────────
    if ($videoSourceMode !== 'simulation' && peaks.length >= 1) {
      const r = classifyDiffraction(dispData, peaks, len);
      patternLabel = r.label;
      patternColor = r.color;
    } else if ($videoSourceMode === 'simulation') {
      patternLabel = '';
    }

    // ── Interferometry Measurement ────────────────────────────────
    if ($enableMeasurement && $videoSourceMode !== 'simulation') {
      if (peaks.length >= 1) {
        const centralPeak = peaks.reduce((best, p) => p.value > best.value ? p : best, peaks[0]);

        const rightPeaks = peaks
          .filter(p => p.index > centralPeak.index)
          .sort((a, b) => a.index - b.index);
        const leftPeaks  = peaks
          .filter(p => p.index < centralPeak.index)
          .sort((a, b) => b.index - a.index);

        const xPlusPeak  = rightPeaks[0] ?? null;
        const xMinusPeak = leftPeaks[0]  ?? null;

        const cmPerPx   = $physFrameWidthCm / len;
        const xPlusVal  = xPlusPeak  ? (xPlusPeak.index  - centralPeak.index) * cmPerPx  : null;
        const xMinusVal = xMinusPeak ? -((centralPeak.index - xMinusPeak.index) * cmPerPx) : null;
        const Pval = (xPlusVal !== null && xMinusVal !== null)
          ? (Math.abs(xPlusVal) + Math.abs(xMinusVal)) / 2
          : null;

        liveInterference.set({
          I:      +dispData[centralPeak.index].toFixed(1),
          xPlus:  xPlusVal  !== null ? +xPlusVal.toFixed(2)  : null,
          xMinus: xMinusVal !== null ? +xMinusVal.toFixed(2) : null,
          P:      Pval      !== null ? +Pval.toFixed(2)      : null
        });

        const idxToX = i => mL + (i / Math.max(len - 1, 1)) * plotW;

        // Central peak line (purple dashed)
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

        // x(+) green line
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

        // x(-) red line
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

        // P bracket
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
        liveInterference.set({ I: null, xPlus: null, xMinus: null, P: null });
      }
    } else if (!$enableMeasurement) {
      liveInterference.set({ I: null, xPlus: null, xMinus: null, P: null });
    }
  }

  // ── Gaussian smoothing ──────────────────────────────────────────
  /**
   * Applies a Gaussian-weighted moving average to smooth the intensity data.
   * @param {number[]} arr   - input data
   * @param {number}   sigma - kernel width (larger = smoother)
   */
  function gaussianSmooth(arr, sigma = 8) {
    const radius = Math.ceil(sigma * 3);
    const kernel = [];
    let kSum = 0;
    for (let i = -radius; i <= radius; i++) {
      const w = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(w);
      kSum += w;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;

    const out = new Float64Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = Math.min(Math.max(i + k, 0), arr.length - 1);
        val += arr[j] * kernel[k + radius];
      }
      out[i] = val;
    }
    return out;
  }

  // ── Peak detection ──────────────────────────────────────────────
  /**
   * Finds local maxima above a threshold.
   * thresholdFraction: fraction of max value — peaks below this are discarded
   *   (set to 0.08 = 8% so barely-visible peaks on screen are removed)
   */
  function findPeaks(arr, windowSize = 10, thresholdFraction = 0.08) {
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
    const centralPeak = peaks.reduce((best, p) =>
      Math.abs(p.index - centerIdx) < Math.abs(best.index - centerIdx) ? p : best, peaks[0]);
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
          Puncak: <strong>{peaksCountDisplay}</strong> |
          Imax: <strong>{maxPeakDisplay.toFixed(1)}</strong>
        </span>
      {/if}
      {#if patternLabel}
        <span class="pattern-badge" style="color:{patternColor}">{patternLabel}</span>
      {/if}
      <button class="download-btn" on:click={downloadPNG} title="Download PNG">Ekspor</button>
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
    background: #0d1117;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.10);
    overflow: hidden;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #161b22;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .chart-title {
    font-size: 14px;
    font-weight: 600;
    color: #e6edf3;
    font-family: Arial, sans-serif;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .peak-stats {
    font-size: 12px;
    color: #8b949e;
    font-family: Arial, sans-serif;
  }

  .peak-stats strong {
    color: #58a6ff;
  }

  .pattern-badge {
    padding: 3px 8px;
    background: rgba(56,189,248,0.10);
    border-radius: 3px;
    font-size: 11px;
    font-weight: bold;
    border: 1px solid rgba(56,189,248,0.25);
    font-family: Arial, sans-serif;
  }

  .download-btn {
    padding: 4px 12px;
    background: rgba(56,189,248,0.10);
    border: 1px solid rgba(56,189,248,0.30);
    border-radius: 3px;
    color: #38bdf8;
    font-size: 12px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    transition: background 0.15s;
  }

  .download-btn:hover {
    background: rgba(56,189,248,0.20);
  }

  .chart-container {
    flex: 1;
    position: relative;
    width: 100%;
    min-height: 0;
    background: #0d1117;
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
