<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen = true;
  const dispatch = createEventDispatcher();

  function close() {
    isOpen = false;
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if isOpen}
  <!-- Backdrop overlay -->
  <div 
    class="modal-backdrop" 
    on:click|self={close}
    role="presentation"
  >
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <!-- Top decorative ambient glow -->
      <div class="glow-orb glow-top-left"></div>
      <div class="glow-orb glow-bottom-right"></div>

      <!-- Header with both Logos -->
      <header class="modal-header">
        <div class="logos-container">
          <div class="logo-box" title="Universitas Lampung">
            <img src="./logo_unila.png" alt="Logo Universitas Lampung" class="institution-logo" />
          </div>
          <div class="logo-separator"></div>
          <div class="logo-box" title="FKIP Universitas Lampung">
            <img src="./logo_fkip.png" alt="Logo FKIP Unila" class="institution-logo" />
          </div>
        </div>

        <div class="header-text">
          <div class="app-badge">Aplikasi Pembelajaran & Penelitian Fisika</div>
          <h2 id="modal-title" class="app-title">LightScope</h2>
          <p class="app-subtitle">Sistem Analisis Intensitas Cahaya & Pola Interferensi</p>
          <p class="faculty-tag">Fakultas Keguruan dan Ilmu Pendidikan • Universitas Lampung</p>
        </div>
      </header>

      <!-- Body: Identity Cards -->
      <div class="modal-body">
        <!-- Developer / Researcher Card -->
        <div class="role-card researcher-card">
          <div class="card-icon-bubble primary-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="card-info">
            <span class="role-label">Peneliti / Pengembang</span>
            <h3 class="person-name highlight-name">Salsabila Putri Azahra Kesuma</h3>
          </div>
        </div>

        <!-- Academic Team Grid -->
        <div class="team-grid">
          <!-- Supervisors (Pembimbing) -->
          <div class="role-card">
            <div class="card-head">
              <div class="card-icon-bubble accent-bubble">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
              </div>
              <span class="role-label">Dosen Pembimbing</span>
            </div>
            <ol class="person-list ordered">
              <li>
                <span class="list-num">1</span>
                <span class="person-name">Dimas Permadi, S.Pd., M.Pd.</span>
              </li>
              <li>
                <span class="list-num">2</span>
                <span class="person-name">Prof. Dr. Kartini Herlina, M.Si.</span>
              </li>
            </ol>
          </div>

          <!-- Column 2: Reviewer & Validators -->
          <div class="stacked-column">
            <!-- Reviewer (Pembahas) -->
            <div class="role-card">
              <div class="card-head">
                <div class="card-icon-bubble cyan-bubble">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <span class="role-label">Dosen Pembahas</span>
              </div>
              <div class="person-item single">
                <span class="person-bullet">•</span>
                <span class="person-name">Prof. Dr. I Wayan Distrik, M.Si.</span>
              </div>
            </div>

            <!-- Validators (Validator) -->
            <div class="role-card">
              <div class="card-head">
                <div class="card-icon-bubble green-bubble">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <span class="role-label">Tim Validator</span>
              </div>
              <ol class="person-list ordered">
                <li>
                  <span class="list-num">1</span>
                  <span class="person-name">Dr. B. Anggit Wicaksono, S.Pd., M.Si.</span>
                </li>
                <li>
                  <span class="list-num">2</span>
                  <span class="person-name">Dr. Ike Festiana, S.Pd., M.Pd.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <!-- Action footer -->
      <footer class="modal-footer">
        <button class="enter-btn primary" on:click={close}>
          <span>Mulai</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop with Blur ─────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 4, 8, 0.82);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Modal Card Container ───────────────────────────── */
  .modal-card {
    position: relative;
    width: 100%;
    max-width: 580px;
    background: linear-gradient(180deg, #181824 0%, #11111a 100%);
    border: 1px solid rgba(124, 106, 247, 0.22);
    border-radius: 18px;
    box-shadow: 
      0 20px 50px rgba(0, 0, 0, 0.85),
      0 0 35px rgba(124, 106, 247, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
    animation: zoomUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .modal-card::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
    width: 0;
    height: 0;
  }

  @keyframes zoomUp {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Ambient glow effects */
  .glow-orb {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(50px);
    z-index: 0;
  }

  .glow-top-left {
    top: -30px;
    left: -30px;
    width: 140px;
    height: 140px;
    background: rgba(124, 106, 247, 0.18);
  }

  .glow-bottom-right {
    bottom: -30px;
    right: -30px;
    width: 130px;
    height: 130px;
    background: rgba(247, 80, 106, 0.12);
  }

  /* ── Header ─────────────────────────────────────────── */
  .modal-header {
    position: relative;
    z-index: 1;
    padding: 16px 20px 10px;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .logos-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
  }

  .logo-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
  }

  .institution-logo {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
  }

  .logo-separator {
    width: 1px;
    height: 26px;
    background: rgba(255, 255, 255, 0.12);
  }

  .header-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .app-badge {
    display: inline-block;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 99px;
    background: rgba(124, 106, 247, 0.14);
    color: #a394fc;
    border: 1px solid rgba(124, 106, 247, 0.28);
    margin-bottom: 1px;
  }

  .app-title {
    font-size: 1.3rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #ffffff 30%, #b8b8d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.2;
  }

  .app-subtitle {
    font-size: 0.78rem;
    font-weight: 500;
    margin: 0;
    color: var(--text-sub);
  }

  .faculty-tag {
    font-size: 0.68rem;
    color: var(--text-muted);
    margin: 1px 0 0;
  }

  /* ── Body ───────────────────────────────────────────── */
  .modal-body {
    position: relative;
    z-index: 1;
    padding: 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .role-card {
    background: rgba(31, 31, 46, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 10px 14px;
    transition: all 0.2s ease;
  }

  .role-card:hover {
    background: rgba(31, 31, 46, 0.85);
    border-color: rgba(124, 106, 247, 0.25);
  }

  .researcher-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(124, 106, 247, 0.12) 0%, rgba(31, 31, 46, 0.7) 100%);
    border: 1px solid rgba(124, 106, 247, 0.35);
    box-shadow: 0 3px 16px rgba(124, 106, 247, 0.1);
    padding: 10px 14px;
  }

  .card-icon-bubble {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .primary-bubble {
    background: linear-gradient(135deg, var(--accent), #5e4bd8);
    color: #fff;
    box-shadow: 0 2px 10px var(--accent-glow);
  }

  .accent-bubble {
    background: rgba(247, 80, 106, 0.15);
    color: var(--accent-2);
    border: 1px solid rgba(247, 80, 106, 0.3);
  }

  .cyan-bubble {
    background: rgba(0, 194, 255, 0.15);
    color: #00c2ff;
    border: 1px solid rgba(0, 194, 255, 0.3);
  }

  .green-bubble {
    background: rgba(46, 204, 135, 0.15);
    color: var(--green);
    border: 1px solid rgba(46, 204, 135, 0.3);
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .role-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .person-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }

  .highlight-name {
    font-size: 0.98rem;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .team-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  @media (min-width: 540px) {
    .team-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .stacked-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .person-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .person-list li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .list-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-sub);
    font-size: 0.6rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .person-item.single {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .person-bullet {
    color: var(--accent);
    font-size: 0.95rem;
    line-height: 1;
    margin-top: 1px;
  }

  /* ── Footer ─────────────────────────────────────────── */
  .modal-footer {
    position: relative;
    z-index: 1;
    padding: 8px 20px 16px;
    display: flex;
    justify-content: center;
  }

  .enter-btn {
    width: 100%;
    max-width: 240px;
    height: 42px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 4px 16px var(--accent-glow);
    transition: all 0.2s ease;
  }

  .enter-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 106, 247, 0.4);
  }
</style>
