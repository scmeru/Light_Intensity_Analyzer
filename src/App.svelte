<script>
  import CameraView from './lib/components/CameraView.svelte';
  import Simulator from './lib/components/Simulator.svelte';
  import LuminanceChart from './lib/components/LuminanceChart.svelte';
  import ControlPanel from './lib/components/ControlPanel.svelte';
  import { isAnalyzing, videoSourceMode } from './lib/store.js';
</script>

<div class="app-layout">
  <!-- Left/Top: Visuals --> 
  <div class="visual-column">
    <header class="app-header">
      <div class="header-brand">
        <span class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.9"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </span>
        <div>
          <h1 class="brand-title">LightScope</h1>
          <p class="brand-sub">Analisis Fisika & Intensitas Cahaya</p>
        </div>
      </div>
      <div class="header-status" class:active={$isAnalyzing}>
        <span class="status-dot"></span>
        <span class="status-text">{$isAnalyzing ? 'Aktif' : 'Standby'}</span>
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
  </aside>
</div>

<style>
  /* ─── Mobile-first: single column, scrollable ──────────── */
  .app-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg);
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
    padding: 14px 16px;
    background: var(--panel-bg);
    border-bottom: 1px solid var(--border);
    gap: 12px;
    flex-shrink: 0;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
    box-shadow: 0 4px 12px var(--accent-glow);
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
    font-size: 0.7rem;
    margin: 0;
    color: var(--text-muted);
    font-weight: 400;
    letter-spacing: 0.01em;
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
