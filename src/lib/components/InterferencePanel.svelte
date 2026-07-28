<script>
  import { 
    enableMeasurement, 
    physL, 
    physLambda, 
    physFrameWidthCm,
    liveInterference, 
    interferenceResults,
    videoSourceMode,
    isAnalyzing
  } from '../store.js';

  let collapsed = false;

  function record() {
    const m = $liveInterference;
    if (m.I === null) return;
    $interferenceResults = [
      ...$interferenceResults,
      { id: Date.now(), L: $physL, lambda: $physLambda, I: m.I, xPlus: m.xPlus, xMinus: m.xMinus, P: m.P }
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
    const header = 'No.,L (m),\u03bb (nm),I (luma),x+ (cm),x- (cm),P (cm)';
    const rows = $interferenceResults.map((r, i) =>
      `${i + 1},${r.L},${r.lambda},${r.I ?? ''},${r.xPlus ?? ''},${r.xMinus ?? ''},${r.P ?? ''}`
    );
    const csv  = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `interferensi-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function fmt(v, d = 2) {
    return (v !== null && v !== undefined) ? Number(v).toFixed(d) : '\u2014';
  }

  function wlToColor(nm) {
    if (nm < 440) return '#8b00ff';
    if (nm < 490) return '#4169e1';
    if (nm < 530) return '#00b94e';
    if (nm < 575) return '#ffd700';
    if (nm < 620) return '#ff8c00';
    return '#dc143c';
  }

  $: wlColor = wlToColor($physLambda);
  $: hasLive = $liveInterference.I !== null;
  $: canRec  = hasLive && $enableMeasurement && $isAnalyzing;
</script>

<div class="ifp-wrap">
  <button class="ifp-header" on:click={() => collapsed = !collapsed}>
    <div class="hdr-left">
      <span class="hdr-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
          <path d="M2 12h20M12 3C9.5 6.5 8 9.1 8 12s1.5 5.5 4 9M12 3c2.5 3.5 4 6.1 4 9s-1.5 5.5-4 9" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </span>
      <span class="hdr-title">Pengukuran Interferensi</span>
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

    <div class="card">
      <div class="card-label">\u2699 Parameter Fisik</div>
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-L">L \u2014 Jarak ke Layar</label>
          <span class="badge">{$physL.toFixed(2)} m</span>
        </div>
        <input id="ifp-L" type="range" min="0.10" max="2.00" step="0.05" bind:value={$physL}>
      </div>
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-lam">\u03bb \u2014 Panjang Gelombang</label>
          <div class="lam-val">
            <span class="wl-dot" style="background:{wlColor}; box-shadow: 0 0 6px {wlColor};"></span>
            <span class="badge">{$physLambda} nm</span>
          </div>
        </div>
        <input id="ifp-lam" type="range" min="380" max="780" step="5" bind:value={$physLambda}>
      </div>
      <div class="param-block">
        <div class="param-hdr">
          <label for="ifp-fw">Lebar Frame Fisik</label>
          <span class="badge">{$physFrameWidthCm.toFixed(1)} cm</span>
        </div>
        <input id="ifp-fw" type="range" min="2" max="120" step="0.5" bind:value={$physFrameWidthCm}>
        <p class="hint">Ukur lebar area yang terlihat kamera di layar sesungguhnya</p>
      </div>
    </div>

    {#if $enableMeasurement}
    <div class="card">
      <div class="card-label">\ud83d\udce1 Hasil Real-time</div>
      <div class="metrics">
        <div class="mc mc-I"  class:lit={hasLive}><div class="mc-lbl">I (luma)</div><div class="mc-val">{fmt($liveInterference.I, 1)}</div></div>
        <div class="mc mc-P"  class:lit={hasLive && $liveInterference.P !== null}><div class="mc-lbl">P (cm)</div><div class="mc-val">{fmt($liveInterference.P)}</div></div>
        <div class="mc mc-xp" class:lit={hasLive && $liveInterference.xPlus !== null}><div class="mc-lbl">x (+) cm</div><div class="mc-val">{$liveInterference.xPlus !== null ? '+' + fmt($liveInterference.xPlus) : '\u2014'}</div></div>
        <div class="mc mc-xm" class:lit={hasLive && $liveInterference.xMinus !== null}><div class="mc-lbl">x (\u2212) cm</div><div class="mc-val">{fmt($liveInterference.xMinus)}</div></div>
      </div>
      <button class="rec-btn" on:click={record} disabled={!canRec}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        Rekam Pengukuran
      </button>
    </div>
    {/if}

    {#if $interferenceResults.length > 0}
    <div class="card">
      <div class="tbl-hdr-row">
        <div class="card-label">\ud83d\udccb Rekaman ({$interferenceResults.length})</div>
        <div class="tbl-acts">
          <button class="act-btn export" on:click={exportCSV} title="Export CSV"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> CSV</button>
          <button class="act-btn trash" on:click={clearAll} title="Hapus Semua"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>
        </div>
      </div>
      <div class="tbl-scroll">
        <table>
          <thead><tr><th>#</th><th>L</th><th>\u03bb</th><th>I</th><th>x+</th><th>x\u2212</th><th>P</th><th></th></tr></thead>
          <tbody>
            {#each $interferenceResults as row, i (row.id)}
            <tr>
              <td class="td-no">{i + 1}</td>
              <td>{row.L}</td>
              <td>{row.lambda}</td>
              <td class="c-I">{fmt(row.I, 1)}</td>
              <td class="c-xp">{row.xPlus !== null ? '+' + fmt(row.xPlus) : '\u2014'}</td>
              <td class="c-xm">{fmt(row.xMinus)}</td>
              <td class="c-P">{fmt(row.P)}</td>
              <td><button class="del" on:click={() => deleteRow(row.id)}>\u00d7</button></td>
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
  .hdr-icon { width:26px; height:26px; border-radius:6px; background:linear-gradient(135deg,var(--accent-2),#f5a623); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; box-shadow:0 2px 8px rgba(247,80,106,0.3); }
  .hdr-title { font-size:0.82rem; font-weight:700; color:var(--text); letter-spacing:0.01em; }
  .live-pill { font-size:0.6rem; font-weight:800; letter-spacing:0.08em; color:var(--green); background:rgba(46,204,135,0.12); border:1px solid rgba(46,204,135,0.3); padding:1px 6px; border-radius:99px; animation:liveBlink 2s ease-in-out infinite; }
  @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .chevron { color:var(--text-muted); transition:transform 0.2s ease; flex-shrink:0; }
  .chevron.rot { transform:rotate(-90deg); }
  .ifp-body { padding:0 16px 16px; display:flex; flex-direction:column; gap:12px; }
  .enable-row { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:var(--radius-md); background:var(--surface); border:1px solid var(--border); cursor:pointer; transition:all 0.25s ease; gap:8px; }
  .enable-row.is-on { background:rgba(247,80,106,0.07); border-color:rgba(247,80,106,0.3); }
  .en-left { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
  .en-dot { width:8px; height:8px; border-radius:50%; background:var(--text-muted); flex-shrink:0; transition:background 0.25s; }
  .enable-row.is-on .en-dot { background:var(--accent-2); }
  .en-dot.pulsing { animation:dotPulse 2s ease-in-out infinite; }
  @keyframes dotPulse { 0%,100%{box-shadow:0 0 0 0 rgba(247,80,106,0.4)} 50%{box-shadow:0 0 0 5px rgba(247,80,106,0)} }
  .en-label { font-size:0.81rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .enable-row input { display:none; }
  .tog-track { position:relative; width:38px; height:20px; background:var(--border-light); border-radius:20px; transition:background 0.3s; flex-shrink:0; }
  .tog-thumb { position:absolute; top:2px; left:2px; width:16px; height:16px; background:white; border-radius:50%; transition:transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275); box-shadow:0 1px 4px rgba(0,0,0,0.35); }
  .enable-row input:checked ~ .tog-track { background:var(--accent-2); }
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
  .metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .mc { padding:10px 8px; border-radius:var(--radius-sm); background:var(--bg-elevated); border:1px solid var(--border); text-align:center; transition:all 0.3s ease; }
  .mc-lbl { font-size:0.63rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:inherit; opacity:0.65; margin-bottom:4px; }
  .mc-val { font-size:1.05rem; font-weight:800; font-family:var(--font-mono); color:inherit; letter-spacing:-0.02em; }
  .mc-I  { color:#9d8ff7; } .mc-P  { color:#f5a623; } .mc-xp { color:#2ecc87; } .mc-xm { color:#f7506a; }
  .mc-I.lit  { background:rgba(157,143,247,0.09); border-color:rgba(157,143,247,0.3); }
  .mc-P.lit  { background:rgba(245,166,35,0.09);  border-color:rgba(245,166,35,0.3); }
  .mc-xp.lit { background:rgba(46,204,135,0.09);  border-color:rgba(46,204,135,0.3); }
  .mc-xm.lit { background:rgba(247,80,106,0.09);  border-color:rgba(247,80,106,0.3); }
  .rec-btn { width:100%; height:40px; border-radius:var(--radius-md); background:linear-gradient(135deg,#f7506a,#c23050); color:#fff; font-size:0.82rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; transition:all 0.2s ease; letter-spacing:0.02em; box-shadow:0 2px 12px rgba(247,80,106,0.25); }
  .rec-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(247,80,106,0.4); }
  .rec-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none; box-shadow:none; }
  .tbl-hdr-row { display:flex; align-items:center; justify-content:space-between; }
  .tbl-acts { display:flex; gap:5px; }
  .act-btn { display:flex; align-items:center; gap:4px; padding:4px 9px; height:auto; border-radius:var(--radius-sm); border:1px solid var(--border-light); background:var(--bg-elevated); color:var(--text-muted); font-size:0.7rem; font-weight:700; cursor:pointer; transition:all 0.15s; letter-spacing:0.03em; }
  .act-btn.export:hover { border-color:var(--green); color:var(--green); }
  .act-btn.trash:hover  { border-color:var(--accent-2); color:var(--accent-2); }
  .tbl-scroll { overflow-x:auto; border-radius:var(--radius-sm); border:1px solid var(--border); max-height:200px; overflow-y:auto; }
  table { width:100%; border-collapse:collapse; font-family:var(--font-mono); white-space:nowrap; font-size:0.68rem; }
  thead tr { background:var(--bg-elevated); position:sticky; top:0; z-index:1; }
  th { padding:6px 7px; color:var(--text-muted); font-weight:800; text-align:center; border-bottom:1px solid var(--border); font-size:0.6rem; text-transform:uppercase; letter-spacing:0.05em; }
  td { padding:5px 7px; text-align:center; color:var(--text-sub); border-bottom:1px solid var(--border); }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover { background:var(--bg-elevated); }
  .td-no { color:var(--text-muted); }
  .c-I { color:#9d8ff7; font-weight:700; } .c-P { color:#f5a623; font-weight:700; }
  .c-xp { color:#2ecc87; font-weight:700; } .c-xm { color:#f7506a; font-weight:700; }
  .del { width:18px; height:18px; border-radius:50%; border:1px solid var(--border-light); background:transparent; color:var(--text-muted); font-size:0.8rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; transition:all 0.15s; line-height:1; }
  .del:hover { background:rgba(247,80,106,0.15); border-color:var(--accent-2); color:var(--accent-2); }
</style>
