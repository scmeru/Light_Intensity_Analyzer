<script>
  import { onMount, onDestroy } from 'svelte';
  import { intensityData, isAnalyzing, videoSourceMode,
           physFrameWidthCm, enableMeasurement, liveInterference,
           physL, physD, physLambda, gratingMode } from '../store.js';

  let canvas;
  let ctx;
  let animationFrameId;
  let resizeObserver;
  let patternLabel = '';
  let patternColor = '#64748b';
  let maxPeakDisplay = 0;
  let peaksCountDisplay = 0;
  let smoothedMax = 1;

  // ── Color palette (LIGHT THEME, NO GLOW) ──────────
  const C = {
    bg:          '#ffffff',
    plotBg:      '#ffffff',
    grid:        '#e2e8f0',
    border:      '#cbd5e1',
    axis:        '#64748b',
    label:       '#475569',
    line:        '#0ea5e9',    // Biru tegas, mirip SS
    dropLine:    '#94a3b8',
    peakTick:    '#334155',
    orderLabel:  '#0284c7',    // Biru tua untuk label orde
    peakSeq:     '#475569',
    xTickLabel:  '#64748b',
    satMark:     'rgba(239, 68, 68, 0.1)', // Merah tipis untuk saturasi
    standby:     '#94a3b8',
  };

  onMount(() => {
    ctx = canvas.getContext('2d', { alpha: false });
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas.parentElement);
    resize();
    loop();
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  function resize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const rect   = parent.getBoundingClientRect();
    const dpr    = window.devicePixelRatio || 1;
    const w      = Math.floor(rect.width);
    const h      = Math.floor(rect.height);
    if (w === 0 || h === 0) return;
    canvas.width        = w * dpr;
    canvas.height       = h * dpr;
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop() {
    if (!$isAnalyzing || $intensityData.length === 0) {
      if (ctx && canvas) {
        drawStandby();
        patternLabel     = '';
        peaksCountDisplay = 0;
        maxPeakDisplay   = 0;
      }
    } else {
      drawChart();
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  const ML = 54, MB = 38, MT = 44, MR = 22;

  function drawStandby() {
    const w = canvas.width  / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    drawBase(w, h, 255, 5);
    ctx.fillStyle    = C.standby;
    ctx.font         = '13px Arial, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— Menunggu sinyal —', w / 2, h / 2);
  }

  function drawBase(w, h, yMax, ySteps) {
    const mL = ML, mB = MB, mT = MT, mR = MR;
    const plotW = w - mL - mR;
    const plotH = h - mT - mB;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.plotBg;
    ctx.fillRect(mL, mT, plotW, plotH);

    ctx.strokeStyle = C.grid;
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    for (let i = 0; i <= ySteps; i++) {
      const y = mT + (plotH / ySteps) * i;
      ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(mL + plotW, y); ctx.stroke();
    }
    
    const xDivs = 8;
    for (let i = 0; i <= xDivs; i++) {
      const x = mL + (plotW / xDivs) * i;
      ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, mT + plotH); ctx.stroke();
    }

    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 1;
    ctx.strokeRect(mL, mT, plotW, plotH);

    ctx.fillStyle    = C.axis;
    ctx.font         = '10px Arial, sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= ySteps; i++) {
      const frac = 1 - i / ySteps;
      const y    = mT + (plotH / ySteps) * i;
      const val  = frac * yMax;
      ctx.fillText(val >= 10 ? val.toFixed(0) : val.toFixed(1), mL - 6, y);
    }

    ctx.save();
    ctx.fillStyle    = C.label;
    ctx.font         = '10px Arial, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(12, mT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Intensitas (0–255)', 0, 0);
    ctx.restore();

    return { plotW, plotH };
  }

  function drawChart() {
    const w = canvas.width  / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    if (w < 80 || h < 60) return;

    const data = $intensityData;
    const len  = data.length;
    if (len === 0) return;

    const mL = ML, mB = MB, mT = MT, mR = MR;

    // 1. Baseline subtraction
    const sorted5  = [...data].sort((a, b) => a - b);
    const floor    = sorted5[Math.floor(sorted5.length * 0.05)] || 0;
    const bsData   = data.map(v => Math.max(0, v - floor));

    // 2. Gaussian smoothing dengan sigma SANGAT KECIL (1.5)
    // Supaya bintik-bintik berdekatan TIDAK MELEBUR jadi satu bukit
    const dispData = gaussianSmooth(bsData, 1.5);
    const bsMax    = Math.max(...dispData, 1);

    if (bsMax > smoothedMax) smoothedMax = bsMax;
    else smoothedMax = smoothedMax * 0.993 + bsMax * 0.007;
    const yMax   = Math.max(smoothedMax * 1.15, 255);
    const ySteps = 5;

    const { plotW, plotH } = drawBase(w, h, yMax, ySteps);

    // X axis ticks
    const xDivs = 8;
    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 1;
    ctx.fillStyle   = C.axis;
    ctx.font        = '9px Arial, sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xDivs; i++) {
      const xi = mL + (plotW / xDivs) * i;
      ctx.beginPath(); ctx.moveTo(xi, mT + plotH); ctx.lineTo(xi, mT + plotH + 4); ctx.stroke();
      if (i > 0 && i < xDivs) {
        const xVal = $enableMeasurement && $videoSourceMode !== 'simulation'
          ? ($physFrameWidthCm * (i / xDivs)).toFixed(1) + 'cm'
          : Math.round((i / xDivs) * len) + '';
        ctx.fillStyle = C.axis;
        ctx.fillText(xVal, xi, mT + plotH + 6);
      }
    }
    
    ctx.textAlign = 'left';
    ctx.fillText($enableMeasurement && $videoSourceMode !== 'simulation' ? '0cm' : '0', mL, mT + plotH + 6);
    ctx.textAlign = 'right';
    ctx.fillText($enableMeasurement && $videoSourceMode !== 'simulation' ? `${$physFrameWidthCm.toFixed(1)}cm` : `${len}`, mL + plotW, mT + plotH + 6);

    ctx.fillStyle    = C.label;
    ctx.font         = '10px Arial, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText($enableMeasurement && $videoSourceMode !== 'simulation' ? 'Posisi (cm)' : 'Posisi (px)', mL + plotW / 2, h - 2);

    // Legend
    {
      const lx = mL + 8, ly = mT - 22;
      ctx.strokeStyle = C.line;
      ctx.lineWidth   = 2;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(lx, ly + 5); ctx.lineTo(lx + 24, ly + 5); ctx.stroke();
      ctx.fillStyle    = C.label;
      ctx.font         = '10px Arial, sans-serif';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Intensitas (luminance)', lx + 30, ly + 5);
    }

    // Points
    let points = [];
    if (len > plotW) {
      const step = len / plotW;
      for (let x = 0; x < plotW; x++) {
        const i0 = Math.floor(x * step);
        const i1 = Math.min(len - 1, Math.ceil((x + 1) * step));
        let pk = 0;
        for (let k = i0; k <= i1; k++) pk = Math.max(pk, dispData[k]);
        points.push({ x: mL + x, y: mT + plotH - (pk / yMax) * plotH });
      }
    } else {
      for (let i = 0; i < len; i++) {
        const xp = mL + (i / (len - 1)) * plotW;
        points.push({ x: xp, y: mT + plotH - (dispData[i] / yMax) * plotH });
      }
    }
    if (points.length === 0) return;

    // Draw Line
    ctx.strokeStyle = C.line;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.setLineDash([]);
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    // Saturation Warning Band (opsional, halus)
    {
      const satThresh = 254 - floor;
      let inSat = false, satStart = 0;
      for (let i = 0; i < len; i++) {
        const isSat = bsData[i] >= satThresh;
        if (isSat && !inSat) { inSat = true; satStart = i; }
        else if (!isSat && inSat) {
          drawSatBand(satStart, i, len, mL, mT, plotH, plotW);
          inSat = false;
        }
      }
      if (inSat) drawSatBand(satStart, len - 1, len, mL, mT, plotH, plotW);
    }

    // ── Deteksi Puncak Cerdas (Plateau Aware) ─────────────────
    const rawPeaks = findPeaksPlateauAware(dispData, 10, 0.03);
    const peaks = enforceMonotonicEnvelope(rawPeaks, dispData);

    const central = peaks.length > 0
      ? peaks.reduce((b, p) => p.value > b.value ? p : b, peaks[0])
      : null;

    const sortedPeaks = [...peaks].sort((a, b) => a.index - b.index);
    const centralSi   = central ? sortedPeaks.findIndex(p => p.index === central.index) : -1;

    // Annotations
    sortedPeaks.forEach((p, si) => {
      const m  = si - centralSi;
      const px = mL + (p.index / (len - 1)) * plotW;
      const py = mT + plotH - (dispData[p.index] / yMax) * plotH;

      ctx.save();
      ctx.strokeStyle = C.dropLine;
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.lineTo(px, mT + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.strokeStyle = C.peakTick;
      ctx.lineWidth   = 1.2;
      ctx.beginPath(); ctx.moveTo(px, mT + plotH); ctx.lineTo(px, mT + plotH + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py - 2); ctx.lineTo(px, py - 6); ctx.stroke();

      const mStr = m === 0 ? 'm = 0' : m > 0 ? `m = +${m}` : `m = −${Math.abs(m)}`;
      ctx.fillStyle    = C.orderLabel;
      ctx.font         = '8px Arial, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(mStr, px, py - 8);

      ctx.fillStyle = C.peakSeq;
      ctx.font      = 'bold 8px Arial, sans-serif';
      ctx.fillText(`p${si + 1}`, px, py - 16);

      const xLabel = $enableMeasurement && $videoSourceMode !== 'simulation'
        ? (p.index * ($physFrameWidthCm / len)).toFixed(1) + 'cm'
        : `${p.index}`;
      ctx.fillStyle    = C.xTickLabel;
      ctx.font         = 'bold 8px Arial, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(xLabel, px, mT + plotH + 7);
    });

    peaksCountDisplay = peaks.length;
    maxPeakDisplay    = peaks.length > 0 ? Math.max(...peaks.map(p => p.value)) : 0;

    if ($videoSourceMode !== 'simulation' && peaks.length >= 1) {
      const r = classifyDiffraction(peaks, len);
      patternLabel = r.label;
      patternColor = r.color;
    } else {
      patternLabel = '';
    }

    if ($enableMeasurement && $videoSourceMode !== 'simulation' && central) {
      const idxToX = i => mL + (i / Math.max(len - 1, 1)) * plotW;

      const rightPeaks = peaks.filter(p => p.index > central.index).sort((a,b)=>a.index-b.index);
      const leftPeaks  = peaks.filter(p => p.index < central.index).sort((a,b)=>b.index-a.index);
      const xPP = rightPeaks[0] ?? null;
      const xMP = leftPeaks[0]  ?? null;

      const cmPerPx   = $physFrameWidthCm / len;
      const xPlusVal  = xPP ? (xPP.index  - central.index) * cmPerPx : null;
      const xMinusVal = xMP ? (central.index - xMP.index) * cmPerPx  : null;
      const Pval = (xPlusVal !== null && xMinusVal !== null)
        ? (xPlusVal + xMinusVal) / 2
        : (xPlusVal ?? xMinusVal);

      const L_cm = $physL * 100;
      let lambdaCalc = null, dCalc = null, theta1 = null;

      if (Pval !== null && Pval > 0 && L_cm > 0) {
        const sinTheta = Pval / Math.sqrt(L_cm * L_cm + Pval * Pval);
        theta1 = +(Math.asin(sinTheta) * (180 / Math.PI)).toFixed(3);
        if ($gratingMode === 'calc_lambda') {
          const d_nm = 1e6 / $physD;
          lambdaCalc = +(d_nm * sinTheta).toFixed(1);
        } else {
          const d_nm = $physLambda / sinTheta;
          dCalc      = +(d_nm / 1000).toFixed(4);
        }
      }

      liveInterference.set({
        I:          +dispData[central.index].toFixed(1),
        xPlus:      xPlusVal  !== null ? +xPlusVal.toFixed(3)  : null,
        xMinus:     xMinusVal !== null ? +xMinusVal.toFixed(3) : null,
        P:          Pval      !== null ? +Pval.toFixed(3)      : null,
        lambdaCalc: lambdaCalc,
        dCalc:      dCalc,
        theta1:     theta1,
      });

      drawMeasLine(idxToX(central.index), mT, mT + plotH, 'rgba(139,92,246,0.6)', [3,4], 'I₀', '#8b5cf6');
      if (xPP && xPlusVal !== null) drawMeasLine(idxToX(xPP.index), mT, mT + plotH, 'rgba(16,185,129,0.7)', [4,4], `x(+)\n${xPlusVal.toFixed(3)}cm`, '#10b981');
      if (xMP && xMinusVal !== null) drawMeasLine(idxToX(xMP.index), mT, mT + plotH, 'rgba(239,68,68,0.7)', [4,4], `x(−)\n${xMinusVal.toFixed(3)}cm`, '#ef4444');
      
      if (xPP && xMP && Pval !== null) {
        const sxP = idxToX(xPP.index), sxM = idxToX(xMP.index);
        const bY  = mT + plotH - 8;
        ctx.save();
        ctx.strokeStyle = 'rgba(245,158,11,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sxM,bY); ctx.lineTo(sxP,bY);
        ctx.moveTo(sxM,bY-4); ctx.lineTo(sxM,bY+4);
        ctx.moveTo(sxP,bY-4); ctx.lineTo(sxP,bY+4);
        ctx.stroke();
        ctx.fillStyle='#f59e0b'; ctx.font='bold 8px Arial'; ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.fillText(`x̄₁ = ${Pval.toFixed(3)} cm`, (sxM+sxP)/2, bY-5);
        ctx.restore();
      }
    } else if (!$enableMeasurement) {
      liveInterference.set({ I: null, xPlus: null, xMinus: null, P: null, lambdaCalc: null, dCalc: null, theta1: null });
    }
  }

  function drawSatBand(i0, i1, len, mL, mT, plotH, plotW) {
    const x0 = mL + (i0 / (len - 1)) * plotW;
    const x1 = mL + (i1 / (len - 1)) * plotW;
    ctx.save();
    ctx.fillStyle = C.satMark;
    ctx.fillRect(x0, mT, Math.max(x1 - x0, 1), plotH);
    ctx.restore();
  }

  function drawMeasLine(x, y0, y1, strokeColor, dash, label, fillColor) {
    ctx.save();
    ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = fillColor; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lines = label.split('\n');
    lines.forEach((ln, i) => ctx.fillText(ln, x, y0 + 3 + i * 10));
    ctx.restore();
  }

  function gaussianSmooth(arr, sigma = 1.5) {
    const radius = Math.ceil(sigma * 3);
    const kernel = new Float64Array(radius * 2 + 1);
    let kSum = 0;
    for (let i = -radius; i <= radius; i++) {
      kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
      kSum += kernel[i + radius];
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;
    const out = new Float64Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let v = 0;
      for (let k = -radius; k <= radius; k++) {
        v += arr[Math.min(Math.max(i + k, 0), arr.length - 1)] * kernel[k + radius];
      }
      out[i] = v;
    }
    return out;
  }

  function findPeaksPlateauAware(arr, windowSize = 10, thresholdFraction = 0.03) {
    const maxVal = Math.max(...arr, 1);
    const absThresh = maxVal * thresholdFraction;
    const peaks = [];

    let i = windowSize;
    while (i < arr.length - windowSize) {
      const val = arr[i];
      if (val < absThresh) {
        i++; continue;
      }
      let isMax = true;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (arr[j] > val) { isMax = false; break; }
      }
      if (isMax) {
        let plateauEnd = i;
        while (plateauEnd < arr.length - windowSize && arr[plateauEnd + 1] === val) {
          plateauEnd++;
        }
        const center = Math.floor((i + plateauEnd) / 2);
        if (peaks.length > 0 && (center - peaks[peaks.length - 1].index) <= windowSize) {
          if (val > peaks[peaks.length - 1].value) {
            peaks[peaks.length - 1] = { index: center, value: val };
          }
        } else {
          peaks.push({ index: center, value: val });
        }
        i = plateauEnd + 1;
      } else {
        i++;
      }
    }
    return peaks;
  }

  function enforceMonotonicEnvelope(rawPeaks, arr) {
    if (rawPeaks.length === 0) return [];
    if (rawPeaks.length === 1) return rawPeaks;
    const central  = rawPeaks.reduce((b, p) => p.value > b.value ? p : b, rawPeaks[0]);
    const leftArr  = rawPeaks.filter(p => p.index < central.index).sort((a,b) => b.index - a.index);
    const rightArr = rawPeaks.filter(p => p.index > central.index).sort((a,b) => a.index - b.index);

    function filterSide(sideArr, pivot) {
      const valid = [];
      let prevVal = pivot;
      for (const p of sideArr) {
        if (p.value <= prevVal) {
          valid.push(p);
          prevVal = p.value;
        }
      }
      return valid;
    }
    return [central, ...filterSide(leftArr, central.value), ...filterSide(rightArr, central.value)];
  }

  function classifyDiffraction(peaks, len) {
    const n = peaks.length;
    if (n === 1) return { label: 'Single Slit', color: '#f59e0b' };
    const maxVal    = Math.max(...peaks.map(p => p.value));
    const centerIdx = len / 2;
    const cp        = peaks.reduce((b,p) => Math.abs(p.index-centerIdx) < Math.abs(b.index-centerIdx) ? p : b, peaks[0]);
    const dom = cp.value / maxVal;
    if (n <= 5 && dom > 0.75) return { label: 'Single Slit', color: '#f59e0b' };
    if (n >  5)               return { label: 'Diffraction Grating', color: '#10b981' };
    return { label: 'Double Slit', color: '#0ea5e9' };
  }

  function downloadPNG() {
    if (!canvas) return;
    const a  = document.createElement('a');
    a.download = `LightScope-${Date.now()}.png`;
    a.href     = canvas.toDataURL('image/png');
    a.click();
  }
</script>

<div class="chart-wrapper">
  <div class="chart-header">
    <div class="chart-title">Profil Intensitas Cahaya</div>
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
    background: #ffffff;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    overflow: hidden;
    min-height: 0;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #cbd5e1;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chart-title {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    font-family: Arial, sans-serif;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .peak-stats {
    font-size: 11px;
    color: #64748b;
    font-family: Arial, sans-serif;
    white-space: nowrap;
  }

  .peak-stats strong { color: #0f172a; }

  .pattern-badge {
    padding: 2px 7px;
    background: #f1f5f9;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid #cbd5e1;
    font-family: Arial, sans-serif;
    white-space: nowrap;
  }

  .download-btn {
    padding: 3px 10px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    color: #475569;
    font-size: 11px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .download-btn:hover { background: #e2e8f0; }

  .chart-container {
    flex: 1;
    position: relative;
    width: 100%;
    min-height: 0;
    background: #ffffff;
    touch-action: pan-x pan-y;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    image-rendering: crisp-edges;
  }
</style>
