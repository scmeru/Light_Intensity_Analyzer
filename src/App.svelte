<script>
  import CameraView from './lib/components/CameraView.svelte';
  import Simulator from './lib/components/Simulator.svelte';
  import LuminanceChart from './lib/components/LuminanceChart.svelte';
  import ControlPanel from './lib/components/ControlPanel.svelte';
  import InterferencePanel from './lib/components/InterferencePanel.svelte';
  import IdentityModal from './lib/components/IdentityModal.svelte';
  import { isAnalyzing, videoSourceMode } from './lib/store.js';

  let showIdentityModal = true;
</script>

<div class="app-layout">
  <!-- Left/Top: Visuals --> 
  <div class="visual-column">
    <header class="app-header">
      <button 
        class="header-brand-btn" 
        on:click={() => showIdentityModal = true}
        title="Klik untuk melihat Identitas Pengembang & Tim Pembimbing"
      >
        <div class="header-logos">
          <img src="./logo_unila.png" alt="Logo Univ Lampung" class="hdr-logo unila-logo" />
          <span class="logo-sep"></span>
          <img src="./logo_fkip.png" alt="Logo FKIP Unila" class="hdr-logo fkip-logo" />
        </div>
        <div class="header-brand-text">
          <div class="brand-title-row">
            <h1 class="brand-title">LightScope</h1>
          </div>
          <p class="brand-sub">Analisis Fisika & Intensitas Cahaya</p>
        </div>
      </button>

      <div class="header-actions">
        <button 
          class="info-badge-btn" 
          on:click={() => showIdentityModal = true}
          title="Identitas Peneliti & Pembimbing"
          aria-label="Info Identitas"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span class="info-label">Identitas</span>
        </button>

        <div class="header-status" class:active={$isAnalyzing}>
          <span class="status-dot"></span>
          <span class="status-text">{$isAnalyzing ? 'Aktif' : 'Standby'}</span>
        </div>
      </div>
    </header>

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

  <!-- Right/Bottom: Controls -->
  <aside class="control-column">
    <ControlPanel />
    <InterferencePanel />
  </aside>

  <!-- Identity Popup Modal -->
  <IdentityModal bind:isOpen={showIdentityModal} />
</div>

<style>
  /* ─── Mobile-first: single column, scrollable ──────────── */
  .app-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    position: relative;
  }

  /* ─── Desktop: Side by side, full-height locked ─────────── */
  @media (min-width: 768px) {
    .app-layout {
      flex-direction: row;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
    }
  }

  /* ─── Visual Column ─────────────────────────────────────── */
  .visual-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  @media (min-width: 768px) {
    .visual-column {
      overflow: hidden; /* desktop: clip overflow within column */
      min-height: 0;
    }
  }

  /* ─── Header ────────────────────────────────────────────── */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--panel-bg);
    border-bottom: 1px solid var(--border);
    gap: 12px;
    flex-shrink: 0;
  }

  .header-brand-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border: none;
    padding: 2px 6px;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    height: auto;
    transition: background 0.15s ease;
  }

  .header-brand-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .header-logos {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.03);
    padding: 3px 6px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .hdr-logo {
    height: 28px;
    width: auto;
    max-width: 32px;
    object-fit: contain;
    filter: drop-shadow(0 1px 4px rgba(0,0,0,0.3));
  }

  .logo-sep {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.15);
  }

  .header-brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
    color: var(--text);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .brand-sub {
    font-size: 0.68rem;
    margin: 0;
    color: var(--text-muted);
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .info-badge-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
    height: 30px;
    border-radius: 999px;
    background: rgba(124, 106, 247, 0.1);
    border: 1px solid rgba(124, 106, 247, 0.28);
    color: #a394fc;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .info-badge-btn:hover {
    background: rgba(124, 106, 247, 0.2);
    border-color: var(--accent);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--accent-glow);
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.3s ease;
    white-space: nowrap;
    height: 30px;
  }

  .header-status.active {
    background: rgba(46, 204, 135, 0.1);
    border-color: rgba(46, 204, 135, 0.3);
    color: var(--green);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .header-status.active .status-dot {
    animation: pulse 1.5s ease-in-out infinite;
    opacity: 1;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  /* ─── Camera section ────────────────────────────────────── */
  .camera-section {
    flex-shrink: 0;
  }

  /* ─── Chart section ─────────────────────────────────────── */
  .chart-section {
    /* Mobile: fixed height so it's always visible without being squished */
    height: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border);
  }

  @media (min-width: 768px) {
    .chart-section {
      flex: 1;    /* desktop: fill remaining space */
      height: auto;
      min-height: 0;
    }
  }

  /* ─── Control Column ────────────────────────────────────── */
  .control-column {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border);
  }

  @media (min-width: 768px) {
    .control-column {
      width: 300px;
      border-top: none;
      border-left: 1px solid var(--border);
      background: var(--panel-bg);
      overflow-y: auto;
      overflow-x: hidden;
    }
  }
</style>
