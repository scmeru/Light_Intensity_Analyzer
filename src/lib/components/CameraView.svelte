<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    isAnalyzing, 
    cameraDevices, 
    selectedDeviceId, 
    roiMode, 
    intensityData,
    mirrorVideo,
    lockExposure,
    bandHeightPercent,
    videoSourceMode,
    uploadedImage,
    isFrozen
  } from '../store.js';

  let videoElement;
  let imageElement;
  let overlayCanvas;
  let hiddenCanvas;
  let hiddenCtx;
  let overlayCtx;

  let stream = null;
  let animationFrameId = null;

  // Manual ROI Box (stored as percentages 0-1)
  let box = { startX: 0.25, startY: 0.25, endX: 0.75, endY: 0.75 };
  let isDragging = false;

  async function getDevices() {
    try {
      const initStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      initStream.getTracks().forEach(t => t.stop()); // Properly close the initial permission stream
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      $cameraDevices = devices.filter(d => d.kind === 'videoinput');
      if ($cameraDevices.length > 0 && !$selectedDeviceId) {
        $selectedDeviceId = $cameraDevices[0].deviceId;
      }
    } catch (err) {
      console.error("Camera access denied or no devices.", err);
    }
  }

  onMount(() => {
    getDevices();
    hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
    overlayCtx = overlayCanvas.getContext('2d');
  });

  onDestroy(() => {
    stopAnalysis();
  });

  let currentAnalyzingId = null;

  $: {
    if ($isAnalyzing) {
      const targetId = $videoSourceMode === 'camera' ? $selectedDeviceId : 'image-mode';
      if (currentAnalyzingId !== targetId) {
        currentAnalyzingId = targetId;
        startAnalysis();
      }
    } else {
      if (currentAnalyzingId !== null) {
        currentAnalyzingId = null;
        stopAnalysis();
      }
    }
  }

  $: {
    if (videoElement) {
      if ($isFrozen) {
        videoElement.pause();
      } else {
        if ($isAnalyzing && $videoSourceMode === 'camera' && stream) {
          videoElement.play().catch(e => console.error(e));
        }
      }
    }
  }

  function toggleFreeze() {
    $isFrozen = !$isFrozen;
  }

  $: {
    if (currentAnalyzingId !== null && stream && stream.getVideoTracks().length > 0) {
      const track = stream.getVideoTracks()[0];
      if (typeof track.applyConstraints === 'function') {
         track.applyConstraints({
           advanced: [{ exposureMode: $lockExposure ? 'manual' : 'continuous' }]
         }).catch(() => {
           // hardware doesn't support exposure constraints
         });
      }
    }
  }

  async function startAnalysis() {
    stopAnalysis(); 
    
    try {
      if ($videoSourceMode === 'camera') {
        if (!$selectedDeviceId) {
          $isAnalyzing = false;
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: $selectedDeviceId },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        if (videoElement) {
          videoElement.srcObject = stream;
          if (!$isFrozen) await videoElement.play();
        }
      }

      loop();
    } catch (err) {
      console.error("Error starting stream", err);
      $isAnalyzing = false;
    }
  }

  function stopAnalysis() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (videoElement) {
       videoElement.srcObject = null;
    }
  }

  // --- Interaction for manual ROI ---
  function getRelPos(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  }

  function pointerDown(e) {
    if ($roiMode !== 'manual') return;
    const pos = getRelPos(e);
    isDragging = true;
    box.startX = pos.x;
    box.startY = pos.y;
    box.endX = pos.x;
    box.endY = pos.y;
  }

  function pointerMove(e) {
    if (!isDragging || $roiMode !== 'manual') return;
    if (e.cancelable) e.preventDefault();
    const pos = getRelPos(e);
    box.endX = pos.x;
    box.endY = pos.y;
  }

  function pointerUp() {
    isDragging = false;
    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);
    box = { startX: minX, startY: minY, endX: maxX, endY: maxY };
  }

  // --- Main Render Loop ---
  let glowPhase = 0;

  function loop() {
    if (!$isAnalyzing) return;

    const isImage = $videoSourceMode === 'image';
    const sourceEl = isImage ? imageElement : videoElement;

    if (!sourceEl) {
      animationFrameId = requestAnimationFrame(loop);
      return;
    }

    if (!isImage && (!stream || videoElement.readyState < 2)) {
      animationFrameId = requestAnimationFrame(loop);
      return;
    }

    const vw = isImage ? sourceEl.naturalWidth : sourceEl.videoWidth;
    const vh = isImage ? sourceEl.naturalHeight : sourceEl.videoHeight;

    if (!vw || !vh) {
      animationFrameId = requestAnimationFrame(loop);
      return;
    }

    if (hiddenCanvas.width !== vw || hiddenCanvas.height !== vh) {
       hiddenCanvas.width = vw;
       hiddenCanvas.height = vh;
       overlayCanvas.width = vw;
       overlayCanvas.height = vh;
    }

    hiddenCtx.save();
    if ($mirrorVideo) {
      hiddenCtx.translate(vw, 0);
      hiddenCtx.scale(-1, 1);
    }
    hiddenCtx.drawImage(sourceEl, 0, 0, vw, vh);
    hiddenCtx.restore();
    
    overlayCtx.clearRect(0, 0, vw, vh);

    let extractX = 0, extractY = 0, extractW = vw, extractH = vh;
    
    // Animation glow phase
    glowPhase += 0.05;
    const glowAlpha = 0.5 + Math.sin(glowPhase) * 0.3;

    if ($roiMode === 'band') {
      const heightPercentage = $bandHeightPercent / 100;
      extractH = Math.max(1, Math.floor(vh * heightPercentage));
      extractY = Math.floor((vh - extractH) / 2);
      
      // Draw dark overlay outside band
      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      overlayCtx.fillRect(0, 0, vw, extractY);
      overlayCtx.fillRect(0, extractY + extractH, vw, vh - (extractY + extractH));

      // Draw scanning band borders
      overlayCtx.strokeStyle = `rgba(124, 106, 247, ${glowAlpha})`;
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(0, extractY, vw, extractH);
      
      // Draw dashed center line
      overlayCtx.beginPath();
      overlayCtx.setLineDash([10, 10]);
      overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      overlayCtx.moveTo(0, extractY + extractH / 2);
      overlayCtx.lineTo(vw, extractY + extractH / 2);
      overlayCtx.stroke();
      overlayCtx.setLineDash([]);

    } else if ($roiMode === 'center') {
      extractY = Math.floor(vh / 2);
      extractH = 1;
      
      // Draw dark overlay
      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      overlayCtx.fillRect(0, 0, vw, extractY - 1);
      overlayCtx.fillRect(0, extractY + 1, vw, vh - extractY);

      // Center Line
      overlayCtx.strokeStyle = `rgba(247, 80, 106, ${0.8 + Math.sin(glowPhase)*0.2})`;
      overlayCtx.lineWidth = 2;
      overlayCtx.beginPath();
      overlayCtx.moveTo(0, extractY);
      overlayCtx.lineTo(vw, extractY);
      overlayCtx.stroke();
      
      // Center crosshair spot
      overlayCtx.fillStyle = '#fff';
      overlayCtx.beginPath();
      overlayCtx.arc(vw/2, extractY, 4, 0, Math.PI * 2);
      overlayCtx.fill();

    } else if ($roiMode === 'manual') {
      extractX = Math.max(0, Math.floor(box.startX * vw));
      extractY = Math.max(0, Math.floor(box.startY * vh));
      extractW = Math.max(1, Math.floor((box.endX - box.startX) * vw));
      extractH = Math.max(1, Math.floor((box.endY - box.startY) * vh));

      // Draw dark overlay outside box
      overlayCtx.fillStyle = 'rgba(0,0,0,0.6)';
      overlayCtx.beginPath();
      overlayCtx.rect(0, 0, vw, vh);
      overlayCtx.rect(extractX, extractY, extractW, extractH);
      overlayCtx.fill('evenodd');

      // Draw Crop Box
      overlayCtx.strokeStyle = '#2ecc87';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(extractX, extractY, extractW, extractH);
      
      // Draw Corner Handles
      overlayCtx.fillStyle = '#2ecc87';
      const hs = 10; // Handle size
      const th = 4; // Thickness
      
      const drawCorner = (x, y, dx, dy) => {
        overlayCtx.fillRect(x, y, dx * hs, dy * th);
        overlayCtx.fillRect(x, y, dx * th, dy * hs);
      };
      
      drawCorner(extractX, extractY, 1, 1); // TL
      drawCorner(extractX + extractW, extractY, -1, 1); // TR
      drawCorner(extractX, extractY + extractH, 1, -1); // BL
      drawCorner(extractX + extractW, extractY + extractH, -1, -1); // BR
    }

    const safeW = Math.min(vw - extractX, extractW);
    const safeH = Math.min(vh - extractY, extractH);

    let imgData;
    try {
      if(safeW > 0 && safeH > 0) {
        imgData = hiddenCtx.getImageData(extractX, extractY, safeW, safeH);
      }
    } catch(e){}
    
    if (imgData) {
      const data = imgData.data;
      const cols = safeW;
      const rows = safeH;
      const newIntensity = new Array(cols).fill(0);

      for(let y = 0; y < rows; y++) {
        for(let x = 0; x < cols; x++) {
          let i = (y * cols + x) * 4;
          let luminance = (data[i]*299 + data[i+1]*587 + data[i+2]*114) / 1000;
          newIntensity[x] += luminance;
        }
      }

      for(let x = 0; x < cols; x++) {
        newIntensity[x] = rows > 1 ? newIntensity[x] / rows : newIntensity[x];
      }

      $intensityData = newIntensity;
    }

    animationFrameId = requestAnimationFrame(loop);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="camera-wrapper">
  <div class="camera-container" 
       on:mousedown={pointerDown} on:mousemove={pointerMove} on:mouseup={pointerUp} on:mouseleave={pointerUp}
       on:touchstart={pointerDown} on:touchmove={pointerMove} on:touchend={pointerUp} on:touchcancel={pointerUp}>
       
    <!-- svelte-ignore a11y-media-has-caption -->
    <video bind:this={videoElement} playsinline muted class:mirrored={$mirrorVideo} style="display: {$videoSourceMode === 'camera' ? 'block' : 'none'}"></video>
    
    <img bind:this={imageElement} src={$uploadedImage} alt="Uploaded" class:mirrored={$mirrorVideo} style="display: {$videoSourceMode === 'image' && $uploadedImage ? 'block' : 'none'}" />
    
    <canvas bind:this={overlayCanvas} class="overlay" class:blocking={$roiMode === 'manual'} class:mirrored={$mirrorVideo}></canvas>
    <canvas bind:this={hiddenCanvas} class="hidden"></canvas>
    
    {#if $videoSourceMode === 'camera' && $isAnalyzing}
      <button class="freeze-btn" class:frozen={$isFrozen} 
              on:click|stopPropagation|preventDefault={toggleFreeze}
              on:mousedown|stopPropagation
              on:touchstart|stopPropagation>
        {#if $isFrozen}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5V19L19 12L8 5Z"/>
          </svg>
        {:else}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="5" width="4" height="14" rx="1"/>
            <rect x="14" y="5" width="4" height="14" rx="1"/>
          </svg>
        {/if}
      </button>

      {#if $isFrozen}
        <div class="freeze-indicator">
          <span>FROZEN</span>
        </div>
      {/if}
    {/if}

    {#if !$isAnalyzing}
      <div class="standby-overlay">
        <div class="glass-panel">
          {#if $videoSourceMode === 'image' && !$uploadedImage}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 16L8.58579 11.4142C9.36683 10.6332 10.6332 10.6332 11.4142 11.4142L16 16M14 14L15.5858 12.4142C16.3668 11.6332 17.6332 11.6332 18.4142 12.4142L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h2>Belum Ada Gambar</h2>
            <p>Pilih gambar dari galeri di panel bawah</p>
          {:else}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 10L19.5528 7.72361C20.2177 7.39116 21 7.87465 21 8.61803V15.382C21 16.1253 20.2177 16.6088 19.5528 16.2764L15 14M5 18H13C14.1046 18 15 17.1046 15 16V8C15 6.89543 14.1046 6 13 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h2>Kamera Standby</h2>
            <p>Tekan Mulai untuk analisis</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .camera-wrapper {
    width: 100%;
    /* Keep it flush with the container to avoid breaking layout */
    background: var(--bg);
  }

  .camera-container {
    position: relative;
    width: 100%;
    /* Adaptive portrait and landscape ratio for mobile */
    aspect-ratio: 4/3; 
    background: #000;
    overflow: hidden;
    flex-shrink: 0;
  }

  @media (max-width: 767px) {
    .camera-container {
      /* Mobile override to avoid huge black bars if screen is skinny */
      aspect-ratio: auto;
      height: 50vh;
    }
  }

  @media (min-width: 768px) {
    .camera-container {
       /* Desktop constraint */
       max-height: 60vh;
       width: auto;
       margin: 0 auto;
       border-bottom-left-radius: var(--radius-lg);
       border-bottom-right-radius: var(--radius-lg);
       border-left: 1px solid var(--border-light);
       border-right: 1px solid var(--border-light);
       border-bottom: 1px solid var(--border-light);
    }
  }
  
  video, img, .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover; /* Cover prevents aspect ratio distortion showing blank spaces on mobile */
  }

  .freeze-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(31, 31, 46, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }

  .freeze-btn:active {
    transform: scale(0.95);
  }

  .freeze-btn.frozen {
    background: rgba(247, 80, 106, 0.8);
    border-color: rgba(247, 80, 106, 1);
    box-shadow: 0 4px 16px rgba(247, 80, 106, 0.4);
    animation: pulseFrozen 2s infinite;
  }

  @keyframes pulseFrozen {
    0% { box-shadow: 0 0 0 0 rgba(247, 80, 106, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(247, 80, 106, 0); }
    100% { box-shadow: 0 0 0 0 rgba(247, 80, 106, 0); }
  }

  .freeze-indicator {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(247, 80, 106, 0.9);
    color: white;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 1px;
    z-index: 30;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .freeze-indicator::before {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
  }
  
  .overlay {
    pointer-events: none;
    z-index: 10;
  }

  .overlay.blocking {
    pointer-events: auto;
    touch-action: none;   
  }
  
  .hidden {
    display: none;
  }

  .standby-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .glass-panel {
    background: rgba(31, 31, 46, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 24px 20px;
    border-radius: var(--radius-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 75%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    color: var(--text);
  }

  .glass-panel svg {
    color: var(--accent);
    margin-bottom: 12px;
  }

  .glass-panel h2 {
    margin: 0 0 4px;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .glass-panel p {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-sub);
    line-height: 1.4;
  }

  .mirrored {
    transform: scaleX(-1);
  }
</style>
