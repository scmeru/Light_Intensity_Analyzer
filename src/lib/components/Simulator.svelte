<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    isAnalyzing, 
    intensityData, 
    simType, 
    simWavelength, 
    simSlitWidth, 
    simSlitDistance, 
    simSlitCount, 
    simScreenDistance,
    simZoom
  } from '../store.js';

  let canvas;
  let ctx;
  let animationFrameId;

  // Convert wavelength (nm) to RGB array [r, g, b]
  function wavelengthToRGB(wl) {
    let r, g, b, f;
    if (wl >= 380 && wl < 440)      { r = -(wl-440)/(440-380); g=0; b=1; }
    else if (wl >= 440 && wl < 490) { r = 0; g=(wl-440)/(490-440); b=1; }
    else if (wl >= 490 && wl < 510) { r = 0; g=1; b=-(wl-510)/(510-490); }
    else if (wl >= 510 && wl < 580) { r = (wl-510)/(580-510); g=1; b=0; }
    else if (wl >= 580 && wl < 645) { r = 1; g=-(wl-645)/(645-580); b=0; }
    else if (wl >= 645 && wl < 781) { r = 1; g=0; b=0; }
    else                             { r=0; g=0; b=0; }

    if      (wl >= 380 && wl < 420) f = 0.3 + 0.7*(wl-380)/(420-380);
    else if (wl >= 420 && wl < 701) f = 1.0;
    else if (wl >= 701 && wl < 781) f = 0.3 + 0.7*(780-wl)/(780-700);
    else                             f = 0;

    return [
      Math.round((r === 0 ? 0 : Math.pow(r*f, 0.8)) * 255),
      Math.round((g === 0 ? 0 : Math.pow(g*f, 0.8)) * 255),
      Math.round((b === 0 ? 0 : Math.pow(b*f, 0.8)) * 255)
    ];
  }

  function sincSq(x) {
    if (Math.abs(x) < 1e-8) return 1;
    return Math.pow(Math.sin(x) / x, 2);
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
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
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
  }

  function loop() {
    const w = canvas.width  / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    if ($isAnalyzing) {
      drawSimulation(w, h);
    } else {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '500 14px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Tekan "Mulai Analisis" untuk menjalankan simulator', w/2, h/2);
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function drawSimulation(w, h) {
    // === Physics parameters ===
    const lambda   = $simWavelength * 1e-6; // nm → mm
    const a        = $simSlitWidth;
    const d        = $simSlitDistance;
    const L        = $simScreenDistance;
    const N        = $simSlitCount;
    const pixPerMm = 10 * $simZoom;

    const [cr, cg, cb] = wavelengthToRGB($simWavelength);

    // Layout margins
    const marginLeft   = 48;
    const marginBottom = 36;
    const marginTop    = 12;
    const marginRight  = 12;
    const plotW = w - marginLeft - marginRight;
    const plotH = h - marginTop  - marginBottom;

    // Background
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, w, h);

    // Compute intensity per pixel
    let intensities = new Float32Array(plotW);
    for (let xi = 0; xi < plotW; xi++) {
      const x_mm = (xi - plotW/2) / pixPerMm;
      const sinT  = Math.sin(Math.atan(x_mm / L));
      const beta  = (Math.PI * a * sinT) / lambda;
      const alpha = (Math.PI * d * sinT) / lambda;

      let intensity = 0;
      const sd = sincSq(beta);
      if ($simType === 'single') {
        intensity = sd;
      } else if ($simType === 'double') {
        intensity = sd * Math.pow(Math.cos(alpha), 2);
      } else if ($simType === 'grating') {
        const sinA = Math.sin(alpha);
        intensity = (Math.abs(sinA) < 1e-7)
          ? sd
          : sd * Math.pow(Math.sin(N * alpha) / sinA, 2) / Math.pow(N, 2);
      }
      intensities[xi] = Math.min(Math.max(intensity, 0), 1);
    }

    // Draw laser diffusion via ImageData for ultra-high performance + realism
    if (!window.__SPECKLE_SIM) {
      window.__SPECKLE_SIM = new Float32Array(2048);
      for(let i = 0; i < 2048; i++) {
        window.__SPECKLE_SIM[i] = Math.pow(Math.random(), 0.7) * 1.6; 
      }
    }
    const SPECKLE = window.__SPECKLE_SIM;

    // Use offscreen canvas to prevent devicePixelRatio mapping bugs on putImageData
    const offCanvas = document.createElement('canvas');
    offCanvas.width = plotW;
    offCanvas.height = plotH;
    const offCtx = offCanvas.getContext('2d');
    
    // Base black background for the plot area
    offCtx.fillStyle = '#06060c';
    offCtx.fillRect(0, 0, plotW, plotH);
    
    const imgDataOut = offCtx.getImageData(0, 0, plotW, plotH);
    const pxData = imgDataOut.data;
    
    const cy_plot   = plotH / 2;
    const spotRadius = Math.max(12, plotH * 0.22);
    
    // Precompute vertical gaussian envelope
    const envLUT = new Float32Array(plotH);
    for(let yi=0; yi<plotH; yi++) {
       const dy = (yi - cy_plot) / spotRadius;
       envLUT[yi] = Math.exp(-dy * dy * 2.5);
    }

    for (let xi = 0; xi < plotW; xi++) {
      let I = intensities[xi];
      I = Math.pow(I, 1.5); // Sharpen peaks slightly
      if (I < 0.008) continue;
      
      for (let yi = 0; yi < plotH; yi++) {
        // Multiply spatial speckle noise for actual particle interference look
        const spk = SPECKLE[((xi * 107) + (yi * 17)) % 2048];
        const al  = I * envLUT[yi] * spk;
        if (al < 0.01) continue;
        
        const idx = (yi * plotW + xi) * 4;
        
        // Hotspot additive color mapping (Bloom core physics)
        pxData[idx]   = Math.min(255, pxData[idx]   + cr * al * 3.0);
        pxData[idx+1] = Math.min(255, pxData[idx+1] + cg * al * 3.0 + (al > 0.5 ? Math.pow(al-0.5, 1.5)*10*255 : 0));
        pxData[idx+2] = Math.min(255, pxData[idx+2] + cb * al * 3.0 + (al > 0.5 ? Math.pow(al-0.5, 1.5)*10*255 : 0));
        pxData[idx+3] = 255;
      }
    }
    // Render the simulated data back to offscreen, then draw scaled hardware-accelerated image
    offCtx.putImageData(imgDataOut, 0, 0);
    ctx.drawImage(offCanvas, marginLeft, marginTop, plotW, plotH);

    // Find peaks
    let peaks = [];
    const wSize = Math.max(5, Math.floor(plotW / 40));
    for (let xi = wSize; xi < plotW - wSize; xi++) {
      const v = intensities[xi];
      if (v < 0.05) continue;
      let isMax = true;
      for (let j = xi - wSize; j <= xi + wSize; j++) {
        if (j !== xi && intensities[j] > v) { isMax = false; break; }
      }
      if (isMax) {
        if (peaks.length > 0 && xi - peaks[peaks.length-1].xi < wSize) {
          if (v > peaks[peaks.length-1].I) peaks[peaks.length-1] = { xi, I: v };
        } else {
          peaks.push({ xi, I: v });
        }
      }
    }

    // Glowing spot circles at peaks removed — the ImageData shader handles this with 100x better realism and performance.

    // X axis line
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop + plotH);
    ctx.lineTo(marginLeft + plotW, marginTop + plotH);
    ctx.stroke();

    // Y axis line
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, marginTop + plotH);
    ctx.stroke();

    // Centre reference lines (dashed)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(marginLeft + plotW/2, marginTop);
    ctx.lineTo(marginLeft + plotW/2, marginTop + plotH);
    ctx.moveTo(marginLeft, marginTop + cy_plot);
    ctx.lineTo(marginLeft + plotW, marginTop + cy_plot);
    ctx.stroke();
    ctx.setLineDash([]);

    // X axis ticks + labels (mm)
    ctx.fillStyle  = 'rgba(255,255,255,0.42)';
    ctx.font       = '500 10px Inter, system-ui';
    ctx.textAlign  = 'center';
    const halfMm     = (plotW / 2) / pixPerMm;
    const xStep      = niceStep(halfMm);
    for (let xmm = -Math.ceil(halfMm/xStep)*xStep; xmm <= halfMm; xmm += xStep) {
      if (Math.abs(xmm) < xStep * 0.01) xmm = 0;
      const sx = marginLeft + plotW/2 + xmm * pixPerMm;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, marginTop + plotH);
      ctx.lineTo(sx, marginTop + plotH + 5);
      ctx.stroke();
      ctx.fillText(fmtMm(xmm), sx, marginTop + plotH + 16);
    }
    // X title
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 11px Inter, system-ui';
    ctx.fillText('x (mm)', marginLeft + plotW/2, h - 4);

    // Y label (rotated)
    ctx.save();
    ctx.translate(13, marginTop + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 11px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('I / I₀', 0, 0);
    ctx.restore();

    // Y grid + tick labels
    [{ frac:0, lbl:'0' }, { frac:0.5, lbl:'0.5' }, { frac:1, lbl:'1' }].forEach(({ frac, lbl }) => {
      const sy = marginTop + plotH - frac * plotH;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(marginLeft, sy);
      ctx.lineTo(marginLeft + plotW, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle  = 'rgba(255,255,255,0.38)';
      ctx.font       = '500 10px Inter, system-ui';
      ctx.textAlign  = 'right';
      ctx.fillText(lbl, marginLeft - 4, sy + 3.5);
    });

    // Peak position labels above each spot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font      = '600 10px Inter, system-ui';
    ctx.textAlign = 'center';
    peaks.forEach(({ xi, I }) => {
      const px  = marginLeft + xi;
      const r   = Math.max(4, I * spotRadius * 0.55);
      const py  = marginTop + cy_plot - r - 7;
      const label = fmtMm((xi - plotW/2) / pixPerMm) + ' mm';
      ctx.fillText(label, px, Math.max(marginTop + 12, py));
    });

    // Feed intensity store → graph
    const out = new Array(plotW).fill(0);
    for (let xi = 0; xi < plotW; xi++) out[xi] = intensities[xi] * 255;
    $intensityData = out;
  }

  function niceStep(range) {
    const rough = range / 4;
    const mag   = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-9))));
    const frac  = rough / mag;
    if (frac < 1.5) return 1 * mag;
    if (frac < 3.5) return 2 * mag;
    if (frac < 7.5) return 5 * mag;
    return 10 * mag;
  }

  function fmtMm(mm) {
    if (Math.abs(mm) < 0.005)  return '0';
    if (Math.abs(mm) >= 10)    return mm.toFixed(0);
    if (Math.abs(mm) >= 1)     return mm.toFixed(1);
    return mm.toFixed(2);
  }
</script>

<div class="simulator-container">
  <canvas bind:this={canvas}></canvas>
  <div class="sim-badge">⚗️ SIMULATOR FISIKA</div>
</div>

<style>
  .simulator-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: #06060c;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sim-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(124, 106, 247, 0.15);
    border: 1px solid rgba(124, 106, 247, 0.35);
    color: rgba(124, 106, 247, 0.9);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    pointer-events: none;
  }
</style>
