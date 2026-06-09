<script>
  import { onMount, onDestroy } from 'svelte';
  import { intensityData, isAnalyzing, videoSourceMode } from '../store.js';

  let canvas;
  let ctx;
  let animationFrameId;
  let patternLabel = '';
  let patternColor = '#00d4ff';
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
    ctx.fillStyle = '#090d12';
    ctx.fillRect(0, 0, w, h);
  }

  function drawStandby() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    // Draw a faint flat-line to indicate standby
    const mL = 56, mB = 42, mT = 20, mR = 24;
    drawAxesAndGrid(w, h, mL, mB, mT, mR, 255, 8);
    ctx.fillStyle = 'rgba(0, 200, 255, 0.2)';
    ctx.font = '500 12px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('— Menunggu sinyal —', w / 2, h / 2);
  }

  /**
   * Draw axes, grid lines, and tick labels.
   * Returns plotW, plotH for use by the caller.
   */
  function drawAxesAndGrid(w, h, mL, mB, mT, mR, yMax, ySteps) {
    const plotW = w - mL - mR;
    const plotH = h - mT - mB;

    // ── Background ──────────────────────────────────────────────
    ctx.fillStyle = '#090d12';
    ctx.fillRect(0, 0, w, h);

    // Subtle plot area fill
    ctx.fillStyle = 'rgba(0, 180, 255, 0.02)';
    ctx.fillRect(mL, mT, plotW, plotH);

    // ── Grid lines ───────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(100, 160, 200, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // Horizontal grid (Y)
    for (let i = 0; i <= ySteps; i++) {
      const y = mT + (plotH / ySteps) * i + 0.5;
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(mL + plotW, y);
      ctx.stroke();
    }
    // Vertical grid (X) — 8 divisions
    const xDivs = 8;
    for (let i = 1; i < xDivs; i++) {
      const x = mL + (plotW / xDivs) * i + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, mT);
      ctx.lineTo(x, mT + plotH);
      ctx.stroke();
    }

    // ── Axes ─────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(100, 180, 220, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mL, mT);
    ctx.lineTo(mL, mT + plotH);
    ctx.lineTo(mL + plotW, mT + plotH);
    ctx.stroke();

    // ── Y-axis ticks & labels ────────────────────────────────────
    ctx.fillStyle = 'rgba(140, 200, 230, 0.7)';
    ctx.font = '10px Inter, system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= ySteps; i++) {
      const frac = 1 - i / ySteps;
      const y = mT + (plotH / ySteps) * i;
      const val = frac * yMax;

      // Tick
      ctx.strokeStyle = 'rgba(100, 180, 220, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mL - 5, y + 0.5);
      ctx.lineTo(mL, y + 0.5);
      ctx.stroke();

      ctx.fillText(val >= 1 ? val.toFixed(0) : val.toFixed(1), mL - 7, y + 3.5);
    }

    // Y-axis title (rotated)
    ctx.save();
    ctx.fillStyle = 'rgba(100, 180, 220, 0.55)';
    ctx.font = '500 9px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.translate(10, mT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Intensitas (luminance)', 0, 0);
    ctx.restore();

    return { plotW, plotH };
  }

  function drawChart() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const data = $intensityData;
    const len = data.length;
    if (len === 0) return;

    const mL = 56, mB = 42, mT = 20, mR = 24;

    // ── AUTO-SCALE Y-axis (KEY for sensitivity) ──────────────────
    const rawMax = Math.max(...data);
    // Smooth the max to prevent axis jumping between frames
    // Fast attack (peak), slow decay (smooth scale-down)
    if (rawMax > smoothedMax) {
      smoothedMax = rawMax;              // instant attack
    } else {
      smoothedMax = smoothedMax * 0.995 + rawMax * 0.005; // slow decay
    }
    const yMax = Math.max(smoothedMax * 1.12, 1); // 12% headroom

    // Nice round Y tick values
    const ySteps = 5;
    const { plotW, plotH } = drawAxesAndGrid(w, h, mL, mB, mT, mR, yMax, ySteps);

    // ── X-axis ticks & label ─────────────────────────────────────
    const xDivs = 8;
    ctx.fillStyle = 'rgba(140, 200, 230, 0.7)';
    ctx.font = '10px Inter, system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i <= xDivs; i++) {
      const xi = mL + (plotW / xDivs) * i;
      const xOff = Math.round((i / xDivs - 0.5) * len);

      ctx.strokeStyle = 'rgba(100, 180, 220, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xi + 0.5, mT + plotH);
      ctx.lineTo(xi + 0.5, mT + plotH + 5);
      ctx.stroke();

      ctx.fillText(xOff === 0 ? '0' : (xOff > 0 ? '+' : '') + xOff, xi, mT + plotH + 15);
    }
    // X label
    ctx.fillStyle = 'rgba(100, 180, 220, 0.5)';
    ctx.font = '500 9px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('x  (px)', mL + plotW / 2, h - 5);

    // ── Build plot points ────────────────────────────────────────
    let points = [];
    if (len > plotW * 2) {
      const step = len / plotW;
      for (let x = 0; x <= plotW; x++) {
        const idx = Math.floor(x * step);
        if (idx < len) {
          points.push({ x: mL + x, y: mT + plotH - (data[idx] / yMax) * plotH });
        }
      }
    } else {
      for (let i = 0; i < len; i++) {
        const xp = mL + (i / (len - 1)) * plotW;
        points.push({ x: xp, y: mT + plotH - (data[i] / yMax) * plotH });
      }
    }
    if (points.length === 0) return;

    // ── Fill under curve (gradient) ──────────────────────────────
    const fillGrad = ctx.createLinearGradient(0, mT, 0, mT + plotH);
    fillGrad.addColorStop(0,   'rgba(0, 210, 255, 0.38)');
    fillGrad.addColorStop(0.6, 'rgba(0, 160, 220, 0.12)');
    fillGrad.addColorStop(1,   'rgba(0, 140, 200, 0.02)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, mT + plotH);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(points[points.length - 1].x, mT + plotH);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ── Plot line (crisp, no glow) ───────────────────────────────
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Peak detection (threshold relative to max for sensitivity) ─
    const peaks = findPeaks(data, 12, 0.04); // 4% of max as threshold

    // Draw peaks
    peaks.forEach((p, idx) => {
      const px  = mL + (p.index / (len - 1)) * plotW;
      const py  = mT + plotH - (p.value / yMax) * plotH;

      // Dashed drop line (thin, subtle)
      ctx.strokeStyle = 'rgba(140, 200, 220, 0.25)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + 4);
      ctx.lineTo(px, mT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Peak crosshair marker (+) — scientific style, no glow
      const cs = 5; // crosshair arm length
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - cs, py); ctx.lineTo(px + cs, py);
      ctx.moveTo(px, py - cs); ctx.lineTo(px, py + cs);
      ctx.stroke();

      // Peak label: x-offset
      const xOff = Math.round(p.index - len / 2);
      const lx = (xOff > 0 ? '+' : '') + xOff;
      ctx.fillStyle = 'rgba(200, 230, 255, 0.8)';
      ctx.font = '500 9px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(lx, px, Math.max(mT + 11, py - 7));

      // Δx bracket to previous peak
      if (idx > 0) {
        const prev = peaks[idx - 1];
        const prevPx = mL + (prev.index / (len - 1)) * plotW;
        const midX   = (prevPx + px) / 2;
        const brY    = mT + plotH + 26;

        // Only draw if fits in canvas
        if (brY + 12 < h) {
          ctx.strokeStyle = 'rgba(46, 204, 135, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(prevPx, brY - 4); ctx.lineTo(prevPx, brY);
          ctx.lineTo(px, brY);
          ctx.lineTo(px, brY - 4);
          ctx.stroke();

          const dx = p.index - prev.index;
          ctx.fillStyle = '#2ecc87';
          ctx.font = '600 9px Inter, system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(`Δx=${dx}px`, midX, brY + 10);
        }
      }
    });

    // Stats
    if (peaks.length > 0) {
      maxPeakDisplay   = Math.max(...peaks.map(p => p.value));
      peaksCountDisplay = peaks.length;
    } else {
      maxPeakDisplay   = 0;
      peaksCountDisplay = 0;
    }

    // Pattern classification
    if ($videoSourceMode !== 'simulation' && peaks.length >= 1) {
      const r = classifyDiffraction(data, peaks, len);
      patternLabel = r.label;
      patternColor = r.color;
    } else if ($videoSourceMode === 'simulation') {
      patternLabel = '';
    }

    // ── Legend (top-right corner) ─────────────────────────────────
    const lgX = mL + plotW - 4;
    const lgY = mT + 6;
    // Swatch
    ctx.fillStyle = 'rgba(0, 180, 255, 0.25)';
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1.5;
    const swW = 22, swH = 10;
    ctx.fillRect(lgX - 80, lgY - 1, swW, swH);
    ctx.strokeRect(lgX - 80, lgY - 1, swW, swH);
    // Label
    ctx.fillStyle = 'rgba(140, 210, 240, 0.7)';
    ctx.font = '500 9px Inter, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Intensitas (luminance)', lgX - 80 + swW + 5, lgY + 7.5);

    // Scale info
    ctx.fillStyle = 'rgba(0, 180, 255, 0.35)';
    ctx.font = '9px Inter, system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`Ymax: ${yMax.toFixed(0)}`, mL + plotW, mT - 5);
  }

  // Peak detection: windowSize = local-max half-width, threshold = fraction of max
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
    const maxVal = Math.max(...peaks.map(p => p.value));
    const centerIdx = len / 2;

    if (n === 1) return { label: '↔ Celah Tunggal (Single Slit)', color: '#f7c948' };

    const centralPeak = peaks.reduce((best, p) =>
      Math.abs(p.index - centerIdx) < Math.abs(best.index - centerIdx) ? p : best, peaks[0]);
    const centralDominance = centralPeak.value / maxVal;

    const spacings = [];
    for (let i = 1; i < peaks.length; i++) spacings.push(peaks[i].index - peaks[i - 1].index);
    const avgSp = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const spacingCV = Math.sqrt(spacings.reduce((a, s) => a + (s - avgSp) ** 2, 0) / spacings.length) / avgSp;

    const vals = peaks.map(p => p.value);
    const avgAmp = vals.reduce((a, b) => a + b, 0) / vals.length;
    const ampCV = Math.sqrt(vals.reduce((a, v) => a + (v - avgAmp) ** 2, 0) / vals.length) / avgAmp;

    if (n <= 5 && centralDominance > 0.75 && ampCV > 0.25) return { label: '↔ Celah Tunggal (Single Slit)', color: '#f7c948' };
    if (n > 5 && spacingCV < 0.15 && ampCV < 0.25)         return { label: '⠿ Kisi Difraksi (Grating)', color: '#2ecc87' };
    if (n >= 2 && n <= 12 && spacingCV < 0.25)              return { label: '⇔ Celah Ganda (Double Slit)', color: '#7c6af7' };
    return { label: `Pola Tidak Dikenal (${n} puncak)`, color: '#a0a0b8' };
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
      <span class="title-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      Profil Intensitas Cahaya
      <span class="mode-tag">AUTO-SCALE</span>
    </div>

    <div class="header-right">
      {#if peaksCountDisplay > 0}
        <span class="peak-stats">
          <span class="stat-item">
            <span class="stat-label">PUNCAK</span>
            <span class="stat-val">{peaksCountDisplay}</span>
          </span>
          <span class="stat-sep">|</span>
          <span class="stat-item">
            <span class="stat-label">Imax</span>
            <span class="stat-val">{maxPeakDisplay.toFixed(1)}</span>
          </span>
        </span>
      {/if}
      {#if patternLabel}
        <span class="pattern-badge" style="--badge-color: {patternColor}">{patternLabel}</span>
      {/if}
      <button class="download-btn" on:click={downloadPNG} title="Download PNG">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 10L12 15M12 15L17 10M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>PNG</span>
      </button>
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
    background: #090d12;
    position: relative;
    overflow: hidden;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 14px;
    background: #0c1118;
    border-bottom: 1px solid rgba(0, 180, 220, 0.18);
    flex-shrink: 0;
  }

  .chart-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(120, 200, 230, 0.85);
    display: flex;
    align-items: center;
    gap: 7px;
    letter-spacing: 0.02em;
  }

  .title-icon {
    color: #00ccff;
    display: flex;
    align-items: center;
  }

  .mode-tag {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(0, 200, 255, 0.6);
    background: rgba(0, 200, 255, 0.08);
    border: 1px solid rgba(0, 200, 255, 0.2);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .peak-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 20, 35, 0.6);
    border: 1px solid rgba(0, 180, 220, 0.15);
    border-radius: 6px;
    padding: 3px 10px;
    font-family: var(--font-mono);
  }

  .stat-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .stat-label {
    font-size: 0.6rem;
    font-weight: 700;
    color: rgba(80, 160, 200, 0.6);
    letter-spacing: 0.06em;
  }

  .stat-val {
    font-size: 0.78rem;
    font-weight: 700;
    color: #00ccff;
  }

  .stat-sep {
    color: rgba(0, 180, 220, 0.2);
    font-size: 0.75rem;
  }

  .pattern-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--badge-color, #00ccff);
    background: color-mix(in srgb, var(--badge-color, #00ccff) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color, #00ccff) 30%, transparent);
    white-space: nowrap;
    transition: all 0.4s ease;
    font-family: var(--font-mono);
  }

  .download-btn {
    height: 28px;
    padding: 0 10px;
    background: rgba(0, 20, 35, 0.6);
    border: 1px solid rgba(0, 180, 220, 0.2);
    border-radius: 5px;
    color: rgba(80, 160, 200, 0.7);
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.2s;
  }

  .download-btn:hover {
    background: rgba(0, 200, 255, 0.1);
    border-color: #00ccff;
    color: #00ccff;
  }

  .chart-container {
    flex: 1;
    position: relative;
    width: 100%;
    min-height: 0;
    overflow: hidden;
    background: #090d12;
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
