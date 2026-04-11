<script>
  import { onMount, onDestroy } from 'svelte';
  import { intensityData, isAnalyzing, videoSourceMode } from '../store.js';

  let canvas;
  let ctx;
  let animationFrameId;
  let patternLabel = ''; // detected diffraction type
  let patternColor = '#7c6af7';
  let maxPeakDisplay = 0;
  let peaksCountDisplay = 0;

  onMount(() => {
    // Gunakan alpha: true karena kita mungkin ingin mengekspor dengan background
    ctx = canvas.getContext('2d', { alpha: true }); 
    resize();
    window.addEventListener('resize', resize);
    loop();
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
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
      if (ctx && canvas && $intensityData.length === 0) {
         clearCanvas();
         drawStandbyOverlay();
         patternLabel = '';
      }
    } else {
       drawChart();
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function clearCanvas() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    // Background gradient for chart
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#16161f');
    bgGrad.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStandbyOverlay() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.font = '500 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Menunggu Data...', w / 2, h / 2);
  }

  function drawChart() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    
    clearCanvas();

    const data = $intensityData;
    const len = data.length;
    if (len === 0) return;

    // Margins for axes — extra bottom padding and right padding to prevent label clipping
    const mL = 42, mB = 38, mT = 12, mR = 24;
    const plotW = w - mL - mR;
    const plotH = h - mT - mB;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
      const y = mT + Math.floor((plotH / 5) * i) + 0.5;
      ctx.moveTo(mL, y); ctx.lineTo(mL + plotW, y);
    }
    for (let i = 1; i <= 5; i++) {
      const x = mL + Math.floor((plotW / 6) * i) + 0.5;
      ctx.moveTo(x, mT); ctx.lineTo(x, mT + plotH);
    }
    ctx.stroke();

    // X axis
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mL, mT + plotH); ctx.lineTo(mL + plotW, mT + plotH);
    ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + plotH);
    ctx.stroke();

    // X axis ticks (centre = 0, units = pixel offset)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px Inter, system-ui';
    ctx.textAlign = 'center';
    const xSteps = 6;
    for (let i = 0; i <= xSteps; i++) {
      const xi = mL + (plotW / xSteps) * i;
      const xOff = Math.round((i / xSteps - 0.5) * len);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(xi, mT + plotH); ctx.lineTo(xi, mT + plotH + 4);
      ctx.stroke();
      ctx.fillText(xOff === 0 ? '0' : (xOff > 0 ? '+' : '') + xOff, xi, mT + plotH + 15);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '500 10px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('x (px)', mL + plotW/2, h - 6);

    // Y axis ticks
    [0, 0.25, 0.5, 0.75, 1].forEach((frac, i) => {
      const sy = mT + plotH - frac * plotH;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.setLineDash([2,3]);
      ctx.beginPath();
      ctx.moveTo(mL, sy); ctx.lineTo(mL + plotW, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText((frac * 255).toFixed(0), mL - 3, sy + 3.5);
    });

    // Setup curve style
    const themeColor = '#7c6af7'; 
    const themeGlow = 'rgba(124, 106, 247, 0.2)';
    
    // Create fill gradient under the line
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, themeGlow);
    fillGrad.addColorStop(1, 'rgba(124, 106, 247, 0)');

    const maxY = 255.0;
    let points = [];
    if (len > plotW * 2) {
      const step = len / plotW;
      for (let x = 0; x <= plotW; x++) {
        const idx = Math.floor(x * step);
        if (idx < len) {
          const y = mT + plotH - (data[idx] / maxY) * plotH;
          points.push({ x: mL + x, y });
        }
      }
    } else {
      for (let i = 0; i < len; i++) {
        const x = mL + (i / (len - 1)) * plotW;
        const y = mT + plotH - (data[i] / maxY) * plotH;
        points.push({ x, y });
      }
    }

    if (points.length === 0) return;

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, mT + plotH);
    for (let i = 0; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[points.length-1].x, mT + plotH);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Stroke curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;

    // Peak Detection Algorithm (Local Maxima)
    function findPeaks(arr, windowSize=15, threshold=25) {
      let peaks = [];
      for (let i = windowSize; i < arr.length - windowSize; i++) {
          let val = arr[i];
          if (val < threshold) continue;
          let isMax = true;
          for(let j = i - windowSize; j <= i + windowSize; j++) {
              if (i !== j && arr[j] > val) {
                  isMax = false;
                  break;
              }
          }
          if (isMax) {
              if (peaks.length > 0 && (i - peaks[peaks.length-1].index) <= windowSize) {
                  if (val > peaks[peaks.length-1].value) {
                      peaks[peaks.length-1] = {index: i, value: val};
                  }
              } else {
                  peaks.push({index: i, value: val});
              }
          }
      }
      return peaks;
    }

    const peaks = findPeaks(data);

    ctx.fillStyle = '#fff';
    ctx.font = '600 10px Inter, system-ui';
    ctx.textAlign = 'center';

    peaks.forEach((p, idx) => {
        const px = mL + (p.index / (len - 1)) * plotW;
        const py = mT + plotH - (p.value / maxY) * plotH;

        // Draw a subtle cross tick (+) for scientific aesthetic instead of gaming red dots
        ctx.beginPath();
        ctx.moveTo(px - 3, py); ctx.lineTo(px + 3, py);
        ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Vertical dashed drop line to X axis
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(px, py + 4);
        ctx.lineTo(px, mT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label: x• Luma
        const xOff = Math.round(p.index - len/2);
        const label = `x:${xOff > 0 ? '+':''}${xOff} L:${p.value.toFixed(0)}`;
        ctx.font = '500 9px Inter, system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(label, px, Math.max(mT + 12, py - 8));

        // Δx arrow to next peak
        if (idx > 0) {
            const prevPx = mL + (peaks[idx-1].index / (len - 1)) * plotW;
            const prevPy = mT + plotH - (peaks[idx-1].value / maxY) * plotH;
            ctx.strokeStyle = 'rgba(46,204,135,0.4)';
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
            ctx.setLineDash([]);
            const deltaX = p.index - peaks[idx-1].index;
            ctx.fillStyle = '#2ecc87';
            ctx.font = '600 9px Inter, system-ui';
            ctx.fillText(`Δx: ${deltaX}px`, (prevPx+px)/2, Math.min((prevPy+py)/2 - 8, mT + plotH - 20));
        }
    });

    // Top Right Peak summary -> moved to HTML
    if (peaks.length > 0) {
      maxPeakDisplay = Math.max(...peaks.map(p => p.value));
      peaksCountDisplay = peaks.length;
    } else {
      maxPeakDisplay = 0;
      peaksCountDisplay = 0;
    }
    // ── Pattern Classification (only for camera/image modes) ──
    if ($videoSourceMode !== 'simulation' && peaks.length >= 1) {
      const result = classifyDiffraction(data, peaks, len);
      patternLabel = result.label;
      patternColor = result.color;
    } else if ($videoSourceMode === 'simulation') {
      patternLabel = '';
    }
  }

  /**
   * Heuristic diffraction pattern classifier.
   * Analyzes peak count, symmetry, spacing variance, and central dominance.
   */
  function classifyDiffraction(data, peaks, len) {
    const n = peaks.length;
    const maxVal = Math.max(...peaks.map(p => p.value));
    const centerIdx = len / 2;

    // Single slit: 1 dominant central peak, secondary peaks << central
    if (n === 1) {
      return { label: '↔ Celah Tunggal (Single Slit)', color: '#f7c948' };
    }

    // Find central peak (closest to center)
    const centralPeak = peaks.reduce((best, p) =>
      Math.abs(p.index - centerIdx) < Math.abs(best.index - centerIdx) ? p : best
    , peaks[0]);
    const centralDominance = centralPeak.value / maxVal;

    // Measure spacing uniformity
    const spacings = [];
    for (let i = 1; i < peaks.length; i++) {
      spacings.push(peaks[i].index - peaks[i-1].index);
    }
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const spacingVariance = spacings.reduce((acc, s) => acc + Math.pow(s - avgSpacing, 2), 0) / spacings.length;
    const spacingCV = Math.sqrt(spacingVariance) / avgSpacing; // coefficient of variation

    // Measure amplitude uniformity
    const peakVals = peaks.map(p => p.value);
    const avgAmp = peakVals.reduce((a, b) => a + b, 0) / peakVals.length;
    const ampVariance = peakVals.reduce((acc, v) => acc + Math.pow(v - avgAmp, 2), 0) / peakVals.length;
    const ampCV = Math.sqrt(ampVariance) / avgAmp;

    // Single slit: central peak is 2x+ higher than secondaries, few peaks
    if (n <= 5 && centralDominance > 0.75 && ampCV > 0.25) {
      return { label: '↔ Celah Tunggal (Single Slit)', color: '#f7c948' };
    }

    // Grating: many peaks (>5), uniform spacing, uniform amplitude
    if (n > 5 && spacingCV < 0.15 && ampCV < 0.25) {
      return { label: '⠿ Kisi Difraksi (Grating)', color: '#2ecc87' };
    }

    // Double slit: moderate peak count, modulated by single-slit envelope
    // peaks roughly uniform spacing but amplitude varies (sinc envelope)
    if (n >= 2 && n <= 12 && spacingCV < 0.25) {
      return { label: '⇔ Celah Ganda (Double Slit)', color: '#7c6af7' };
    }

    // Fallback
    return { label: `Pola Tidak Dikenal (${n} puncak)`, color: '#a0a0b8' };
  }

  function downloadPNG() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `LightScope-Luminance-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
</script>

<div class="chart-wrapper">
  <div class="chart-header">
    <div class="chart-title">
      <span class="icon">📈</span> Profil Intensitas Cahaya
    </div>
    
    <div class="header-right">
      {#if peaksCountDisplay > 0}
        <span class="peak-stats">PUNCAK: {peaksCountDisplay}</span>
      {/if}
      {#if patternLabel}
        <span class="pattern-badge" style="--badge-color: {patternColor}">{patternLabel}</span>
      {/if}
      <button class="download-btn" on:click={downloadPNG} title="Download Chart as PNG">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 10L12 15M12 15L17 10M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Simpan PNG</span>
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
    background: var(--bg-elevated);
    position: relative;
    overflow: hidden;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .chart-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .download-btn {
    height: 32px;
    padding: 0 12px;
    background: var(--panel-bg-alt);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    color: var(--text-sub);
    font-size: 0.75rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .download-btn:hover {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    box-shadow: 0 2px 8px var(--accent-glow);
  }
  
  @media (max-width: 480px) {
    .download-btn span {
      display: none;
    }
    .download-btn {
      padding: 0 8px;
    }
  }

  .chart-container {
    flex: 1;
    position: relative;
    width: 100%;
    min-height: 0;      /* critical: allows flex child to shrink below content height */
    overflow: hidden;   /* prevent canvas from overflowing outside bounds */
    background: var(--bg);
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .pattern-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--badge-color, #7c6af7);
    background: color-mix(in srgb, var(--badge-color, #7c6af7) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color, #7c6af7) 35%, transparent);
    white-space: nowrap;
    transition: all 0.4s ease;
  }

  .peak-stats {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-sub);
    background: var(--panel-bg-alt);
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
  }



</style>
