<script>
  import { 
    enableMeasurement, 
    physL, 
    physLambda, 
    physFrameWidthCm,
    physD,
    gratingMode,
    liveInterference, 
    interferenceResults,
    videoSourceMode,
    isAnalyzing
  } from '../store.js';

  let collapsed = false;

  // Preset kisi umum (lines/mm)
  const GRATING_PRESETS = [100, 150, 300, 600, 1200];

  function record() {
    const m = $liveInterference;
    if (m.I === null) return;
    $interferenceResults = [
      ...$interferenceResults,
      {
        id:         Date.now(),
        L:          $physL,
        D:          $physD,
        lambda:     $physLambda,
        mode:       $gratingMode,
        I:          m.I,
        xPlus:      m.xPlus,
        xMinus:     m.xMinus,
        P:          m.P,
        theta1:     m.theta1,
        lambdaCalc: m.lambdaCalc,
        dCalc:      m.dCalc,
      }
    ];
  }

  function deleteRow(id) {
    $interferenceResults = $interferenceResults.filter(r => r.id !== id);
  }

  function clearAll() {
    if ($interferenceResults.length === 0) return;
    $interferenceResults = [];
  }

  function exportCSV() {
    const isCalcLambda = $gratingMode === 'calc_lambda';
    const header = isCalcLambda
      ? 'No.,L (m),d (l/mm),I (luma),x+ (cm),x- (cm),x̄₁ (cm),θ₁ (°),λ_hitung (nm)'
      : 'No.,L (m),λ (nm),I (luma),x+ (cm),x- (cm),x̄₁ (cm),θ₁ (°),d_hitung (µm)';
    const rows = $interferenceResults.map((r, i) =>
      isCalcLambda
        ? `${i+1},${r.L},${r.D ?? ''},${r.I ?? ''},${r.xPlus ?? ''},${r.xMinus ?? ''},${r.P ?? ''},${r.theta1 ?? ''},${r.lambdaCalc ?? ''}`
        : `${i+1},${r.L},${r.lambda ?? ''},${r.I ?? ''},${r.xPlus ?? ''},${r.xMinus ?? ''},${r.P ?? ''},${r.theta1 ?? ''},${r.dCalc ?? ''}`
    );
    const csv  = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `difraksi-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function fmt(v, d = 3) {
    return (v !== null && v !== undefined) ? Number(v).toFixed(d) : '—';
  }

  function wlToColor(nm) {
    if (nm < 440) return '#8b00ff';
    if (nm < 490) return '#4169e1';
    if (nm < 530) return '#00b94e';
    if (nm < 575) return '#ffd700';
    if (nm < 620) return '#ff8c00';
    return '#dc143c';
  }

  $: wlColor   = wlToColor($physLambda);
  $: hasLive   = $liveInterference.I !== null;
  $: canRec    = hasLive && $enableMeasurement && $isAnalyzing;
  $: isCalcLam = $gratingMode === 'calc_lambda';

  // d dalam µm dari lines/mm
  $: d_um = (1 / $physD) * 1000;  // µm

  // Hasil live
  $: live = $liveInterference;
</script>

<div class="ifp-wrap">
  <button class="ifp-header" on:click={() => collapsed = !collapsed}>
    <div class="hdr-left">
      <span class="hdr-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="hdr-title">Difraksi Kisi — Pengukuran</span>
      {#if $enableMeasurement && hasLive}
        <span class="live-pill">LIVE</span>
      {/if}
    </div>
    <svg class="chevron" class:rot={collapsed} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  {#if !collapsed}
  <div class="ifp-body">

    <label class="enable-row" class:is-on={$enableMeasurement}>
      <div class="en-left">
        <span class="en-dot" class:pulsing={$enableMeasurement}></span>
        <span class="en-label">{$enableMeasurement ? 'Pengukuran Aktif' : 'Aktifkan Pengukuran'}</span>
      </div>
      <input type="checkbox" bind:checked={$enableMeasurement}>
      <div class="tog-track"><div class="tog-thumb"></div></div>
    </label>

    {#if $videoSourceMode === 'simulation'}
      <div class="notice">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Mode simulasi tidak mendukung pengukuran fisik
      </div>
    {:else}

    <!-- ── Mode Pengukuran ─────────────────────────────────────── -->
    <div class="card">
      <div class="card-label">⚗ Mode Perhitungan</div>
      <div class="mode-toggle">
        <button class="mode-btn" class:active={isCalcLam}
                on:click={() => $gratingMode = 'calc_lambda'}>
          Hitung λ
          <span class="mode-sub">d diketahui → cari λ</span>
        </button>
        <button class="mode-btn" class:active={!isCalcLam}
                on:click={() => $gratingMode = 'calc_d'}>
          Hitung d
          <span class="mode-sub">λ diketahui → cari d</span>
        </button>
      </div>

      <!-- Rumus aktif -->
      <div class="formula-box">
        {#if isCalcLam}
          <span class="formula">λ = d · sin θ₁</span>
          <span class="formula-hint">d = 1/{$physD} mm = {d_um.toFixed(3)} µm</span>
        {:else}
          <span class="formula">d = λ / sin θ₁</span>
          <span class="formula-hint">λ = {$physLambda} nm (laser diketahui)</span>
        {/if}
      </div>
    </div>

    <!-- ── Parameter Fisik ──────────────────────────────────────── -->
    <div class="card">
      <div class="card-label">⚙ Parameter Fisik</div>

      <!-- L -->
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-L">L — Jarak Kisi ke Kamera</label>
          <span class="badge">{$physL.toFixed(2)} m</span>
        </div>
        <input id="ifp-L" type="range" min="0.05" max="2.00" step="0.01" bind:value={$physL}>
      </div>

      <!-- Lebar Frame -->
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-fw">Lebar Frame Fisik</label>
          <span class="badge">{$physFrameWidthCm.toFixed(1)} cm</span>
        </div>
        <input id="ifp-fw" type="range" min="1" max="60" step="0.5" bind:value={$physFrameWidthCm}>
        <p class="hint">Ukur lebar area yang terlihat kamera di layar sesungguhnya</p>
      </div>

      <!-- d (kisi) — hanya saat mode calc_lambda -->
      {#if isCalcLam}
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-D">d — Konstanta Kisi</label>
          <span class="badge">{$physD} l/mm</span>
        </div>
        <input id="ifp-D" type="range" min="50" max="1800" step="50" bind:value={$physD}>
        <!-- Preset -->
        <div class="presets">
          {#each [100,150,300,600,1200] as p}
            <button class="preset-btn" class:sel={$physD === p}
                    on:click={() => $physD = p}>{p}</button>
          {/each}
        </div>
        <p class="hint">Kisi umum: 300, 600, 1200 l/mm</p>
      </div>

      {:else}
      <!-- λ — hanya saat mode calc_d -->
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-lam">λ — Panjang Gelombang Laser</label>
          <div class="lam-val">
            <span class="wl-dot" style="background:{wlColor}; box-shadow: 0 0 6px {wlColor};"></span>
            <span class="badge">{$physLambda} nm</span>
          </div>
        </div>
        <input id="ifp-lam" type="range" min="380" max="780" step="5" bind:value={$physLambda}>
        <!-- Preset laser umum -->
        <div class="presets">
          {#each [405,445,532,635,650,670] as p}
            <button class="preset-btn" class:sel={$physLambda === p}
                    on:click={() => $physLambda = p}>{p}</button>
          {/each}
        </div>
        <p class="hint">Preset: 405 (violet), 532 (green), 650 (red)</p>
      </div>
      {/if}
    </div>

    <!-- ── Hasil Real-time ──────────────────────────────────────── -->
    {#if $enableMeasurement}
    <div class="card">
      <div class="card-label">📡 Hasil Real-time</div>

      <!-- Baris 1: posisi & sudut -->
      <div class="metrics">
        <div class="mc mc-xp" class:lit={hasLive && live.xPlus !== null}>
          <div class="mc-lbl">x(+) cm</div>
          <div class="mc-val">{live.xPlus !== null ? '+' + fmt(live.xPlus) : '—'}</div>
        </div>
        <div class="mc mc-xm" class:lit={hasLive && live.xMinus !== null}>
          <div class="mc-lbl">x(−) cm</div>
          <div class="mc-val">{fmt(live.xMinus)}</div>
        </div>
        <div class="mc mc-P" class:lit={hasLive && live.P !== null}>
          <div class="mc-lbl">x̄₁ (cm)</div>
          <div class="mc-val">{fmt(live.P)}</div>
        </div>
        <div class="mc mc-th" class:lit={hasLive && live.theta1 !== null}>
          <div class="mc-lbl">θ₁ (°)</div>
          <div class="mc-val">{fmt(live.theta1)}</div>
        </div>
      </div>

      <!-- Baris 2: hasil hitung utama -->
      {#if isCalcLam}
      <div class="result-box" class:lit={hasLive && live.lambdaCalc !== null}>
        <div class="res-lbl">λ terhitung</div>
        <div class="res-val">{live.lambdaCalc !== null ? live.lambdaCalc.toFixed(1) + ' nm' : '—'}</div>
        {#if live.lambdaCalc !== null}
          <div class="res-err">
            Δ = {Math.abs(live.lambdaCalc - $physLambda).toFixed(1)} nm
            ({((Math.abs(live.lambdaCalc - $physLambda) / $physLambda) * 100).toFixed(2)}%)
          </div>
        {/if}
      </div>
      {:else}
      <div class="result-box" class:lit={hasLive && live.dCalc !== null}>
        <div class="res-lbl">d terhitung</div>
        <div class="res-val">{live.dCalc !== null ? live.dCalc + ' µm' : '—'}</div>
        {#if live.dCalc !== null}
          <div class="res-err">
            ≈ {live.dCalc !== null ? (1000 / live.dCalc).toFixed(0) : '—'} l/mm
          </div>
        {/if}
      </div>
      {/if}

      <div class="mc mc-I small" class:lit={hasLive}>
        <div class="mc-lbl">I₀ (luma)</div>
        <div class="mc-val">{fmt(live.I, 1)}</div>
      </div>

      <button class="rec-btn" on:click={record} disabled={!canRec}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        Rekam Pengukuran
      </button>
    </div>
    {/if}

    <!-- ── Tabel Rekaman ────────────────────────────────────────── -->
    {#if $interferenceResults.length > 0}
    <div class="card">
      <div class="tbl-hdr-row">
        <div class="card-label">📋 Rekaman ({$interferenceResults.length})</div>
        <div class="tbl-acts">
          <button class="act-btn export" on:click={exportCSV} title="Export CSV">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            CSV
          </button>
          <button class="act-btn trash" on:click={clearAll} title="Hapus Semua">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      <div class="tbl-scroll">
        <table>
          <thead><tr>
            <th>#</th><th>L(m)</th><th>x̄₁(cm)</th><th>θ₁(°)</th>
            {#if isCalcLam}<th>λ(nm)</th>{:else}<th>d(µm)</th>{/if}
            <th></th>
          </tr></thead>
          <tbody>
            {#each $interferenceResults as row, i (row.id)}
            <tr>
              <td class="td-no">{i + 1}</td>
              <td>{row.L}</td>
              <td class="c-P">{fmt(row.P)}</td>
              <td class="c-th">{fmt(row.theta1)}</td>
              {#if row.mode === 'calc_lambda'}
                <td class="c-lam">{row.lambdaCalc !== null ? row.lambdaCalc.toFixed(1) : '—'}</td>
              {:else}
                <td class="c-lam">{row.dCalc !== null ? row.dCalc : '—'}</td>
              {/if}
              <td><button class="del" on:click={() => deleteRow(row.id)}>×</button></td>
            </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    {/if}

    {/if}
  </div>
  {/if}
</div>

<style>
  .ifp-wrap { border-top: 1px solid var(--border); }
  .ifp-header { width:100%; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:transparent; border:none; border-radius:0; height:auto; cursor:pointer; color:var(--text); transition:background 0.15s; }
  .ifp-header:hover { background: var(--surface); }
  .hdr-left { display:flex; align-items:center; gap:8px; }
  .hdr-icon { width:26px; height:26px; border-radius:6px; background:linear-gradient(135deg,#38bdf8,#7c6af7); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; box-shadow:0 2px 8px rgba(56,189,248,0.30); }
  .hdr-title { font-size:0.82rem; font-weight:700; color:var(--text); letter-spacing:0.01em; }
  .live-pill { font-size:0.6rem; font-weight:800; letter-spacing:0.08em; color:var(--green); background:rgba(46,204,135,0.12); border:1px solid rgba(46,204,135,0.3); padding:1px 6px; border-radius:99px; animation:liveBlink 2s ease-in-out infinite; }
  @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .chevron { color:var(--text-muted); transition:transform 0.2s ease; flex-shrink:0; }
  .chevron.rot { transform:rotate(-90deg); }
  .ifp-body { padding:0 16px 16px; display:flex; flex-direction:column; gap:12px; }
  .enable-row { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:var(--radius-md); background:var(--surface); border:1px solid var(--border); cursor:pointer; transition:all 0.25s ease; gap:8px; }
  .enable-row.is-on { background:rgba(56,189,248,0.07); border-color:rgba(56,189,248,0.3); }
  .en-left { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
  .en-dot { width:8px; height:8px; border-radius:50%; background:var(--text-muted); flex-shrink:0; transition:background 0.25s; }
  .enable-row.is-on .en-dot { background:#38bdf8; }
  .en-dot.pulsing { animation:dotPulse 2s ease-in-out infinite; }
  @keyframes dotPulse { 0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,0.4)} 50%{box-shadow:0 0 0 5px rgba(56,189,248,0)} }
  .en-label { font-size:0.81rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .enable-row input { display:none; }
  .tog-track { position:relative; width:38px; height:20px; background:var(--border-light); border-radius:20px; transition:background 0.3s; flex-shrink:0; }
  .tog-thumb { position:absolute; top:2px; left:2px; width:16px; height:16px; background:white; border-radius:50%; transition:transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275); box-shadow:0 1px 4px rgba(0,0,0,0.35); }
  .enable-row input:checked ~ .tog-track { background:#38bdf8; }
  .enable-row input:checked ~ .tog-track .tog-thumb { transform:translateX(18px); }
  .notice { display:flex; align-items:center; gap:7px; font-size:0.77rem; color:var(--text-muted); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 12px; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:12px; display:flex; flex-direction:column; gap:10px; }
  .card-label { font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted); }
  .param-block { display:flex; flex-direction:column; gap:6px; padding-top:8px; border-top:1px dashed var(--border-light); }
  .param-hdr { display:flex; justify-content:space-between; align-items:center; }
  .param-hdr label { font-size:0.78rem; font-weight:500; color:var(--text-sub); }
  .badge { font-size:0.73rem; font-weight:700; color:var(--accent); font-family:var(--font-mono); background:rgba(124,106,247,0.1); padding:2px 8px; border-radius:99px; white-space:nowrap; }
  .lam-val { display:flex; align-items:center; gap:6px; }
  .wl-dot { width:11px; height:11px; border-radius:50%; flex-shrink:0; transition:background 0.2s, box-shadow 0.2s; }
  .hint { margin:0; font-size:0.67rem; color:var(--text-muted); line-height:1.4; font-style:italic; }
  /* Mode toggle */
  .mode-toggle { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
  .mode-btn { display:flex; flex-direction:column; align-items:center; padding:8px 6px; border-radius:var(--radius-md); border:1px solid var(--border); background:var(--bg-elevated); color:var(--text-muted); font-size:0.75rem; font-weight:700; cursor:pointer; transition:all 0.2s; gap:2px; }
  .mode-btn.active { background:rgba(56,189,248,0.12); border-color:rgba(56,189,248,0.40); color:#38bdf8; }
  .mode-sub { font-size:0.60rem; font-weight:400; opacity:0.7; }
  /* Formula box */
  .formula-box { background:var(--bg-elevated); border:1px solid var(--border-light); border-radius:var(--radius-sm); padding:8px 12px; display:flex; flex-direction:column; gap:2px; }
  .formula { font-family:var(--font-mono); font-size:0.85rem; font-weight:700; color:var(--accent); letter-spacing:0.04em; }
  .formula-hint { font-size:0.65rem; color:var(--text-muted); }
  /* Presets */
  .presets { display:flex; gap:4px; flex-wrap:wrap; }
  .preset-btn { padding:2px 7px; border-radius:99px; border:1px solid var(--border-light); background:var(--bg-elevated); color:var(--text-muted); font-size:0.65rem; font-weight:700; cursor:pointer; transition:all 0.15s; }
  .preset-btn.sel { background:rgba(124,106,247,0.15); border-color:var(--accent); color:var(--accent); }
  /* Metrics */
  .metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .mc { padding:8px 6px; border-radius:var(--radius-sm); background:var(--bg-elevated); border:1px solid var(--border); text-align:center; transition:all 0.3s ease; }
  .mc.small { padding:6px 8px; }
  .mc-lbl { font-size:0.60rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:inherit; opacity:0.65; margin-bottom:3px; }
  .mc-val { font-size:0.95rem; font-weight:800; font-family:var(--font-mono); color:inherit; letter-spacing:-0.02em; }
  .mc-I  { color:#9d8ff7; } .mc-P  { color:#f5a623; }
  .mc-xp { color:#2ecc87; } .mc-xm { color:#f7506a; }
  .mc-th { color:#38bdf8; }
  .mc-I.lit  { background:rgba(157,143,247,0.09); border-color:rgba(157,143,247,0.3); }
  .mc-P.lit  { background:rgba(245,166,35,0.09);  border-color:rgba(245,166,35,0.3); }
  .mc-xp.lit { background:rgba(46,204,135,0.09);  border-color:rgba(46,204,135,0.3); }
  .mc-xm.lit { background:rgba(247,80,106,0.09);  border-color:rgba(247,80,106,0.3); }
  .mc-th.lit { background:rgba(56,189,248,0.09);  border-color:rgba(56,189,248,0.3); }
  /* Result box */
  .result-box { padding:12px; border-radius:var(--radius-md); background:var(--bg-elevated); border:2px solid var(--border); text-align:center; transition:all 0.3s ease; }
  .result-box.lit { background:rgba(56,189,248,0.08); border-color:rgba(56,189,248,0.35); }
  .res-lbl { font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); margin-bottom:4px; }
  .res-val { font-size:1.55rem; font-weight:900; font-family:var(--font-mono); color:#38bdf8; letter-spacing:-0.03em; line-height:1; }
  .res-err { font-size:0.65rem; color:var(--text-muted); margin-top:4px; }
  /* Record button */
  .rec-btn { width:100%; height:40px; border-radius:var(--radius-md); background:linear-gradient(135deg,#38bdf8,#7c6af7); color:#fff; font-size:0.82rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; transition:all 0.2s ease; letter-spacing:0.02em; box-shadow:0 2px 12px rgba(56,189,248,0.25); }
  .rec-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(56,189,248,0.40); }
  .rec-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none; box-shadow:none; }
  /* Table */
  .tbl-hdr-row { display:flex; align-items:center; justify-content:space-between; }
  .tbl-acts { display:flex; gap:5px; }
  .act-btn { display:flex; align-items:center; gap:4px; padding:4px 9px; height:auto; border-radius:var(--radius-sm); border:1px solid var(--border-light); background:var(--bg-elevated); color:var(--text-muted); font-size:0.7rem; font-weight:700; cursor:pointer; transition:all 0.15s; letter-spacing:0.03em; }
  .act-btn.export:hover { border-color:var(--green); color:var(--green); }
  .act-btn.trash:hover  { border-color:#f7506a; color:#f7506a; }
  .tbl-scroll { overflow-x:auto; border-radius:var(--radius-sm); border:1px solid var(--border); max-height:200px; overflow-y:auto; }
  table { width:100%; border-collapse:collapse; font-family:var(--font-mono); white-space:nowrap; font-size:0.68rem; }
  thead tr { background:var(--bg-elevated); position:sticky; top:0; z-index:1; }
  th { padding:6px 7px; color:var(--text-muted); font-weight:800; text-align:center; border-bottom:1px solid var(--border); font-size:0.6rem; text-transform:uppercase; letter-spacing:0.05em; }
  td { padding:5px 7px; text-align:center; color:var(--text-sub); border-bottom:1px solid var(--border); }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover { background:var(--bg-elevated); }
  .td-no { color:var(--text-muted); }
  .c-P { color:#f5a623; font-weight:700; }
  .c-th { color:#38bdf8; font-weight:700; }
  .c-lam { color:#9d8ff7; font-weight:700; }
  .del { width:18px; height:18px; border-radius:50%; border:1px solid var(--border-light); background:transparent; color:var(--text-muted); font-size:0.8rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; transition:all 0.15s; line-height:1; }
  .del:hover { background:rgba(247,80,106,0.15); border-color:#f7506a; color:#f7506a; }
</style>
