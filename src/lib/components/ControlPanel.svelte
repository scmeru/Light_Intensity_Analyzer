<script>
  import { 
    isAnalyzing, 
    cameraDevices, 
    selectedDeviceId, 
    roiMode,
    mirrorVideo,
    lockExposure,
    bandHeightPercent,
    videoSourceMode,
    uploadedImage
  } from '../store.js';

  let fileInput;

  function toggleAnalysis() {
    $isAnalyzing = !$isAnalyzing;
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
      if ($uploadedImage) {
        URL.revokeObjectURL($uploadedImage);
      }
      $uploadedImage = URL.createObjectURL(file);
      // Auto-start analysis if we upload an image and it's not analyzing
      if (!$isAnalyzing) {
        $isAnalyzing = true;
      }
    }
  }

  function triggerUpload() {
    if (fileInput) fileInput.click();
  }
</script>

<div class="control-panel">
  <!-- Tabs Source -->
  <div class="source-tabs">
    <button 
      class="tab-btn" 
      class:active={$videoSourceMode === 'camera'}
      on:click={() => $videoSourceMode = 'camera'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 10L19.5528 7.72361C20.2177 7.39116 21 7.87465 21 8.61803V15.382C21 16.1253 20.2177 16.6088 19.5528 16.2764L15 14M5 18H13C14.1046 18 15 17.1046 15 16V8C15 6.89543 14.1046 6 13 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Kamera
    </button>
    <button 
      class="tab-btn" 
      class:active={$videoSourceMode === 'image'}
      on:click={() => $videoSourceMode = 'image'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 16L8.58579 11.4142C9.36683 10.6332 10.6332 10.6332 11.4142 11.4142L16 16M14 14L15.5858 12.4142C16.3668 11.6332 17.6332 11.6332 18.4142 12.4142L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Gambar
    </button>
  </div>

  <div class="card">
    {#if $videoSourceMode === 'camera'}
      <div class="input-group">
        <label for="camera-select">Pilih Kamera</label>
        <div class="select-wrapper">
          <select id="camera-select" bind:value={$selectedDeviceId} disabled={$isAnalyzing}>
            {#if $cameraDevices.length === 0}
              <option value="">Kamera Tidak Ditemukan</option>
            {:else}
              {#each $cameraDevices as device}
                <option value={device.deviceId}>
                  {device.label || `Kamera ${device.deviceId.substring(0, 5)}...`}
                </option>
              {/each}
            {/if}
          </select>
        </div>
      </div>

      <div class="options-inline">
        <label class="modern-toggle">
          <span class="toggle-title">Cermin Video</span>
          <input type="checkbox" bind:checked={$mirrorVideo}>
          <div class="toggle-slider"></div>
        </label>
        
        <label class="modern-toggle">
          <span class="toggle-title">Kunci Eksposur</span>
          <input type="checkbox" bind:checked={$lockExposure}>
          <div class="toggle-slider"></div>
        </label>
      </div>

    {:else}
      <div class="upload-section">
        <input 
          type="file" 
          accept="image/*" 
          bind:this={fileInput} 
          on:change={handleImageUpload} 
          style="display: none;" 
        />
        <button class="upload-btn" on:click={triggerUpload}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 16V17C4 18.1046 4.89543 19 6 19H18C19.1046 19 20 18.1046 20 17V16M16 8L12 4M12 4L8 8M12 4V16" stroke="CurrentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {$uploadedImage ? 'Pilih Gambar Lain' : 'Pilih Gambar dari Galeri'}
        </button>
      </div>
    {/if}
  </div>

  <div class="card">
    <div class="input-group">
      <label for="mode-select">Mode Region of Interest (ROI)</label>
      <div class="select-wrapper">
        <select id="mode-select" bind:value={$roiMode}>
          <option value="band">Band Profile (Lebar Penuh)</option>
          <option value="center">Center Line (Satu Baris)</option>
          <option value="manual">Manual Box (Custom)</option>
        </select>
      </div>
    </div>

    {#if $roiMode === 'band'}
      <div class="slider-group">
        <div class="slider-header">
          <label for="band-slider">Tinggi Band</label>
          <span class="value-badge">{$bandHeightPercent}%</span>
        </div>
        <input id="band-slider" type="range" min="1" max="100" bind:value={$bandHeightPercent}>
      </div>
    {/if}
  </div>

  <div class="action-section">
    <button 
      class="action-btn {$isAnalyzing ? 'danger' : 'primary'}" 
      on:click={toggleAnalysis}
    >
      {#if $isAnalyzing}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
        </svg>
        Hentikan Analisis
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
        </svg>
        Mulai Analisis
      {/if}
    </button>
  </div>
</div>

<style>
  .control-panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    z-index: 100;
  }

  .source-tabs {
    display: flex;
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: 6px;
    border: 1px solid var(--border);
  }

  .tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-weight: 600;
    transition: all 0.25s ease;
    height: 40px;
    border-radius: var(--radius-md);
  }

  .tab-btn.active {
    background: var(--bg-elevated);
    color: var(--accent);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    border: 1px solid var(--border-light);
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-sub);
  }

  .select-wrapper {
    position: relative;
    width: 100%;
  }

  .select-wrapper select {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border-light);
    color: var(--text);
    padding: 12px 36px 12px 14px;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 500;
    appearance: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-wrapper select:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .select-wrapper select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .select-wrapper select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .select-wrapper::after {
    content: '';
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a0a0b8' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    pointer-events: none;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px dashed var(--border-light);
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .value-badge {
    background: var(--panel-bg-alt);
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent);
    font-family: var(--font-mono);
  }

  input[type="range"] {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 6px;
    background: var(--bg);
    outline: none;
    margin: 8px 0;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: 0 0 10px var(--accent-glow);
    border: 2px solid #fff;
    transition: transform 0.1s ease;
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .options-inline {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border-light);
  }

  .modern-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .toggle-title {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
  }

  .modern-toggle input {
    display: none;
  }

  .toggle-slider {
    position: relative;
    width: 40px;
    height: 22px;
    background-color: var(--border-light);
    border-radius: 22px;
    transition: background-color 0.3s ease;
    flex-shrink: 0;
  }

  .toggle-slider::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background-color: white;
    border-radius: 50%;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .modern-toggle input:checked + .toggle-slider {
    background-color: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }

  .modern-toggle input:checked + .toggle-slider::after {
    transform: translateX(18px);
  }

  .upload-section {
    display: flex;
    justify-content: center;
  }

  .upload-btn {
    width: 100%;
    height: 64px;
    background: transparent;
    border: 2px dashed var(--accent);
    color: var(--accent);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .upload-btn:hover {
    background: var(--accent-glow);
    border-color: #8d7df8;
    color: #fff;
  }

  .action-section {
    margin-top: 4px;
  }

  .action-btn {
    width: 100%;
    height: 54px;
    font-size: 1rem;
    border-radius: var(--radius-lg);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    letter-spacing: 0.02em;
    font-weight: 600;
  }

  .action-btn.primary {
    background: linear-gradient(135deg, var(--accent), #5e4bd8);
  }

  .action-btn.danger {
    background: linear-gradient(135deg, var(--danger), #d0304a);
    box-shadow: 0 4px 16px var(--danger-glow);
    animation: dangerPulse 2s infinite;
  }

  @keyframes dangerPulse {
    0% { box-shadow: 0 0 0 0 rgba(247, 80, 106, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(247, 80, 106, 0); }
    100% { box-shadow: 0 0 0 0 rgba(247, 80, 106, 0); }
  }
</style>
