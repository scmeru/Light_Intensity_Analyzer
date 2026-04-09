<script>
  import { onMount, onDestroy } from 'svelte';
  import { intensityData, isAnalyzing } from '../store.js';

  let canvas;
  let ctx;
  let animationFrameId;

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

    // Draw Modern Grid Matrix 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Horizontal lines
    for(let i = 1; i <= 4; i++) {
        let y = Math.floor((h / 5) * i) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    // Vertical lines
    for(let i = 1; i <= 5; i++) {
        let x = Math.floor((w / 6) * i) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    ctx.stroke();

    // Setup curve style
    const themeColor = '#7c6af7'; 
    const themeGlow = 'rgba(124, 106, 247, 0.2)';
    
    // Create fill gradient under the line
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, themeGlow);
    fillGrad.addColorStop(1, 'rgba(124, 106, 247, 0)');

    const maxY = 255.0; // Y = 0..255 luminance range
    
    ctx.beginPath();
    let points = [];
    
    if (len > w * 2) {
      const step = len / w;
      for (let x = 0; x <= w; x++) {
        const index = Math.floor(x * step);
        if (index < len) {
            const val = data[index];
            const y = h - ((val / maxY) * h);
            points.push({x, y});
        }
      }
    } else {
      for (let i = 0; i < len; i++) {
        const val = data[i];
        const x = (i / (len - 1)) * w;
        const y = h - ((val / maxY) * h);
        points.push({x, y});
      }
    }

    if (points.length === 0) return;

    // Fill Path
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    for(let i=0; i<points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length-1].x, h);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Stroke Path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1; i<points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;

    // Peak Label
    let peak = 0;
    for(let i=0; i<len; i++) { if(data[i] > peak) peak = data[i]; }
    
    ctx.fillStyle = '#fff';
    ctx.font = '600 12px Inter, system-ui';
    ctx.textAlign = 'right';
    
    // Small pill background for peak
    const peakText = `PEAK: ${peak.toFixed(1)}`;
    const textW = ctx.measureText(peakText).width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(w - textW - 20, 10, textW + 16, 24, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(peakText, w - 12, 26);
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
      <span class="icon">📈</span> Profil Intensitas Real-time
    </div>
    
    <button class="download-btn" on:click={downloadPNG} title="Download Chart as PNG">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 10L12 15M12 15L17 10M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Simpan PNG</span>
    </button>
  </div>
  
  <div class="chart-container">
    <canvas bind:this={canvas}></canvas>
    
    <div class="axis-labels y-axis">
      <span>255</span>
      <span>191</span>
      <span>127</span>
      <span>64</span>
      <span>0</span>
    </div>
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
    min-height: 150px;
    background: var(--bg);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .axis-labels {
    position: absolute;
    left: 8px;
    top: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
    font-size: 0.65rem;
    color: rgba(255,255,255,0.4);
    font-family: var(--font-mono);
  }
</style>
