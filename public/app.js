// ═══════════════════════════════════════════════════════════════════════════
// EconIntel v3.0 — Premium Command Center
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const state = {
    allArticles: [],
    categoryData: {},
    markets: null,
    regions: null,
    intelReport: null,
    currentView: 'dashboard',
    searchQuery: '',
    isLoading: false,
  };

  const CATEGORIES = ['finance','government','trade','geopolitics','conflicts','technology','thinktanks'];
  
  const TITLES = {
    dashboard: '📊 Intelligence Dashboard',
    markets: '📈 Global Live Markets',
    finance: '💹 Financial Markets',
    government: '🏛️ Government & Central Banks',
    trade: '🚢 International Trade',
    geopolitics: '🌍 Geopolitical Developments',
    conflicts: '⚔️ Global Conflicts Monitor',
    technology: '💻 Technology & Innovation',
    thinktanks: '🧠 Strategic Think Tanks',
    regions: '🗺️ Regional Risk Matrices',
    intel: '📋 Official Executive Briefing',
  };

  const CLOCKS = [
    { city: 'NYC', tz: 'America/New_York' },
    { city: 'LON', tz: 'Europe/London' },
    { city: 'FRA', tz: 'Europe/Berlin' },
    { city: 'DXB', tz: 'Asia/Dubai' },
    { city: 'HND', tz: 'Asia/Tokyo' },
  ];

  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const qa = sel => document.querySelectorAll(sel);

  // Core Init
  function init() {
    bindEvents();
    startClocks();
    initLoadState();
    fetchCoreData();
    setInterval(fetchCoreData, 60000); // 1 min sync
  }

  function bindEvents() {
    // Nav routing
    qa('.nav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.dataset.target;
        switchView(target);
        if(window.innerWidth <= 768) $('sidebar').classList.remove('open');
      });
    });

    // Mobile menu
    $('mobile-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

    // Global Search
    const searchInput = $('global-search');
    searchInput.addEventListener('input', debounce(() => {
      state.searchQuery = searchInput.value.trim().toLowerCase();
      renderCurrentView();
    }, 300));

    // Refresh Sync
    $('btn-refresh').addEventListener('click', () => fetchCoreData(true));

    // Sorting
    $('sort-dashboard').addEventListener('change', () => renderDashboard());
    qa('.sort-cat').forEach(sel => {
      sel.addEventListener('change', e => {
        renderCategory(e.target.dataset.cat);
      });
    });

    // Modal close
    $('close-modal').addEventListener('click', closeModal);
    $('article-modal').addEventListener('click', e => {
      if (e.target.id === 'article-modal') closeModal();
    });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') closeModal();
    });
  }

  function switchView(viewId) {
    state.currentView = viewId;
    
    // Update active nav
    qa('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = q(`.nav-btn[data-target="${viewId}"]`);
    if(btn) btn.classList.add('active');

    // Toggle views
    qa('.view-section').forEach(s => s.classList.remove('active'));
    $(`view-${viewId}`).classList.add('active');

    // Load necessary data if not present
    if (viewId === 'markets' && !state.markets) fetchMarketsData();
    if (viewId === 'regions' && !state.regions) fetchRegionsData();
    if (viewId === 'intel' && !state.intelReport) fetchIntelData();
    if (CATEGORIES.includes(viewId)) {
      if(!state.categoryData[viewId]) fetchCategory(viewId);
      else renderCategory(viewId);
    }
  }

  function renderCurrentView() {
    if (state.currentView === 'dashboard') renderDashboard();
    else if (CATEGORIES.includes(state.currentView)) renderCategory(state.currentView);
  }

  // ── API Fetchers ──
  async function fetchCoreData(force = false) {
    if(state.isLoading) return;
    try {
      state.isLoading = true;
      const btn = $('btn-refresh');
      btn.classList.add('loading');
      $('error-banner').style.display = 'none';

      const ts = force ? `?t=${Date.now()}` : '';
      const [newsRes, marketsRes] = await Promise.allSettled([
        fetch(`/api/news${ts}`),
        fetch(`/api/markets${ts}`)
      ]);

      if(newsRes.status === 'fulfilled' && newsRes.value.ok) {
        const d = await newsRes.value.json();
        state.allArticles = d.articles || [];
        processCategories();
        updateNavBadges();
        if(state.currentView === 'dashboard') renderDashboard();
      }

      if(marketsRes.status === 'fulfilled' && marketsRes.value.ok) {
        state.markets = await marketsRes.value.json();
        renderTicker();
        renderMiniHeatmaps();
        if(state.currentView === 'markets') renderMarketsView();
      } else {
        $('ticker-track').innerHTML = '<span class="ticker-loading">Market data temporarily unavailable</span>';
      }

      // Refresh opened views
      if (CATEGORIES.includes(state.currentView)) renderCategory(state.currentView);
      if (state.regions) fetchRegionsData();
      if (state.intelReport) fetchIntelData();

    } catch (e) {
      console.error(e);
      $('error-banner').style.display = 'flex';
    } finally {
      state.isLoading = false;
      $('btn-refresh').classList.remove('loading');
    }
  }

  async function fetchCategory(cat) {
    try {
      const res = await fetch(`/api/news/${cat}`);
      if(res.ok) {
        const d = await res.json();
        state.categoryData[cat] = d.articles || [];
        if(state.currentView === cat) renderCategory(cat);
      }
    } catch(e) { console.error(e); }
  }

  async function fetchMarketsData() {
    try {
      const res = await fetch('/api/markets');
      if(res.ok) { state.markets = await res.json(); renderMarketsView(); renderTicker(); renderMiniHeatmaps(); }
    } catch(e) { console.error(e); }
  }

  async function fetchRegionsData() {
    try {
      const res = await fetch('/api/regions');
      if(res.ok) { state.regions = (await res.json()).regions; renderRegionsView(); }
    } catch(e) { console.error(e); }
  }

  async function fetchIntelData() {
    try {
      const res = await fetch('/api/intel-report');
      if(res.ok) { state.intelReport = await res.json(); renderIntelView(); }
    } catch(e) { console.error(e); }
  }

  // ── Data Processing ──
  function processCategories() {
    state.categoryData = {};
    state.allArticles.forEach(a => {
      if(!state.categoryData[a.category]) state.categoryData[a.category] = [];
      state.categoryData[a.category].push(a);
      if(a._isConflict) {
        if(!state.categoryData['conflicts']) state.categoryData['conflicts'] = [];
        state.categoryData['conflicts'].push({ ...a, category: 'conflicts' });
      }
    });
  }

  function updateNavBadges() {
    CATEGORIES.forEach(c => {
      const el = $(`badge-${c}`);
      if(el) {
        const count = state.categoryData[c]?.length || 0;
        el.textContent = count > 0 ? count : '';
        el.style.display = count > 0 ? 'inline-block' : 'none';
      }
    });
  }

  // ── Renders ──

  function renderDashboard() {
    const articles = state.allArticles;
    const count = articles.length;
    
    // 1. Metrics Grid
    const critSum = articles.filter(a => a.impactScore >= 8).length;
    const avg = count ? (articles.reduce((acc, a) => acc + a.impactScore, 0) / count).toFixed(1) : 0;
    const srcs = new Set(articles.map(a => a.source)).size;

    $('metrics-grid').innerHTML = `
      <div class="metric-card"><div class="mc-lbl">Total Intel</div><div class="mc-val" style="color:var(--color-cyan)">${count}</div></div>
      <div class="metric-card"><div class="mc-lbl">Critical Threats</div><div class="mc-val" style="color:var(--color-red)">${critSum}</div></div>
      <div class="metric-card"><div class="mc-lbl">Avg Severity</div><div class="mc-val" style="color:var(--color-amber)">${avg}</div></div>
      <div class="metric-card"><div class="mc-lbl">Source Nodes</div><div class="mc-val" style="color:var(--color-purple)">${srcs}</div></div>
    `;

    // 2. Critical Alerts Stack (Impact >= 8)
    const crits = articles.filter(a => a.impactScore >= 8).sort((a,b)=>b.impactScore - a.impactScore).slice(0,4);
    const critEl = $('critical-alerts');
    if(crits.length) {
      critEl.innerHTML = crits.map(a => `
        <div class="alert-row" onclick="window.viewArticle('${a.id}')">
          <div class="ar-score">${a.impactScore}</div>
          <div class="ar-body">
            <div class="ar-title">${esc(a.title)}</div>
            <div class="ar-meta"><span class="tag" style="background:var(--color-red);color:#fff">${a.category}</span> <span>${esc(a.source)} • ${tAgo(a.publishedAt)}</span></div>
          </div>
        </div>
      `).join('');
    }

    // 3. Spotlight / Top Stories Grid
    let gridArts = [...articles];
    const sort = $('sort-dashboard').value;
    if(sort === 'newest') gridArts.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    else gridArts.sort((a,b) => b.impactScore - a.impactScore);

    if(state.searchQuery) {
      const q = state.searchQuery;
      gridArts = gridArts.filter(a => a.title.toLowerCase().includes(q) || a.source.toLowerCase().includes(q));
    }

    // Filter out ones already in critical alerts so we don't duplicate on dash
    const critIds = new Set(crits.map(c=>c.id));
    gridArts = gridArts.filter(a => !critIds.has(a.id)).slice(0, 12);

    renderArticleCards('spotlight-grid', gridArts);

    // 4. Regional Risks stub update if loaded early
    if(state.regions) renderDashRegions();
  }

  function renderCategory(cat) {
    let arts = state.categoryData[cat] || [];
    const sort = q(`.sort-cat[data-cat="${cat}"]`)?.value || 'impact';
    
    arts = [...arts];
    if(sort === 'newest') arts.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    else arts.sort((a,b) => b.impactScore - a.impactScore);

    if(state.searchQuery) {
      const query = state.searchQuery;
      arts = arts.filter(a => a.title.toLowerCase().includes(query) || a.source.toLowerCase().includes(query));
    }

    renderArticleCards(`grid-${cat}`, arts);
  }

  function renderArticleCards(containerId, articles) {
    const el = $(containerId);
    if(!el) return;
    if(!articles.length) { el.innerHTML = `<div class="empty-state">No intelligence found matching constraints.</div>`; return; }

    el.innerHTML = articles.map((a, i) => {
      const c = getColor(a.impactScore);
      return `
        <div class="news-card" style="--var-color:${c}; animation:fadeIn ${0.1 + i*0.02}s ease forwards" onclick="window.viewArticle('${a.id}')">
          <div class="nc-body">
            <div class="nc-meta">
              <span class="tag">${a.category}</span>
              <div class="impact-ring">${a.impactScore}</div>
            </div>
            <div class="nc-title">${esc(a.title)}</div>
            <div class="nc-excerpt">${esc(a.summary || a.content || '')}</div>
          </div>
          <div class="nc-footer">
            <span>${esc(a.source)} • ${tAgo(a.publishedAt)}</span>
            ${a.hasFullContent ? '<span class="full-badge">✦ AI SUMMARY</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Markets ──
  function renderTicker() {
    if(!state.markets) return;
    const items = [...(state.markets.indices||[]), ...(state.markets.commodities||[]), ...(state.markets.currencies||[])]
      .filter(m => m.available && m.changePercent !== null);
    
    if(!items.length) return;
    $('ticker-track').innerHTML = items.concat(items).map(m => {
      const up = parseFloat(m.change) >= 0;
      const fPrice = formatMoney(m.price, m.currency);
      return `<div class="ticker-item"><span class="t-name">${m.name}</span><span class="t-price">${fPrice}</span><span class="t-pct ${up?'up':'down'}">${up?'+':''}${m.changePercent}%</span></div>`;
    }).join('');
  }

  function renderMiniHeatmaps() {
    if(!state.markets) return;
    const sec = state.markets.sectors?.filter(s=>s.available).slice(0,6) || [];
    const com = state.markets.commodities?.filter(s=>s.available).slice(0,4) || [];
    
    const hFn = (arr) => arr.map(m => {
      const p = parseFloat(m.changePercent);
      const bg = getHeatColor(p);
      return `<div class="hm-cell" style="background:${bg}"><span class="n">${m.name}</span><span class="p">${p>0?'+':''}${p}%</span></div>`;
    }).join('');

    const sEl = $('dashboard-sector-heat');
    if(sEl && sec.length) sEl.innerHTML = hFn(sec);
    
    const cEl = $('dashboard-commodity-heat');
    if(cEl && com.length) cEl.innerHTML = hFn(com);
  }

  function renderDashRegions() {
    if(!state.regions) return;
    const el = $('dashboard-risk-list');
    if(el) {
      el.innerHTML = state.regions.slice(0,5).map(r => {
        const risk = r.outlook?.riskLevel || 'Stable';
        const cl = risk.toLowerCase().includes('elevated') ? 'rr-elevated' : risk.toLowerCase().includes('moderate') ? 'rr-moderate' : 'rr-stable';
        return `<div class="risk-row"><span class="rr-name">${r.emoji} ${esc(r.name)}</span><span class="rr-badge ${cl}">${risk}</span></div>`;
      }).join('');
    }
  }

  function renderMarketsView() {
    if(!state.markets) return;
    const m = state.markets;
    
    // Treemap Heatmap function
    const bHeat = (arr, elId) => {
      if(!arr) return;
      
      const el = $(elId);
      if(!el) return;

      const validItems = arr.filter(i => i.available && i.changePercent != null);
      if(validItems.length === 0) {
        el.innerHTML = '<div class="empty-state">Market data temporarily unavailable.</div>';
        return;
      }

      // Calculate the maximum absolute change to establish a baseline for flex-grow proportion
      const maxChange = Math.max(...validItems.map(i => Math.abs(parseFloat(i.changePercent))));
      // To prevent dead-flat items from disappearing entirely, enforce a minimum baseline
      const minGrow = Math.max(0.2, maxChange * 0.1); 

      el.innerHTML = validItems.map(i => {
        const pct = parseFloat(i.changePercent);
        const bg = getHeatColor(pct);
        
        // Calculate the proportion box size
        // Use the absolute value of the change to dictate screen real-estate size
        const absChange = Math.abs(pct);
        const growValue = Math.max(absChange, minGrow).toFixed(2);
        
        return `<div class="tree-cell" style="background:${bg}; flex-grow: ${growValue}; flex-basis: ${(growValue / maxChange * 30).toFixed(1)}%;">` +
                 `<span class="n">${i.name}</span>` +
                 `<span class="p">${pct>0?'+':''}${pct}%</span>` +
               `</div>`;
      }).join('');
    };

    const bCards = (arr, elId) => {
      if(!arr) return;
      const el = $(elId);
      if(!el) return;
      el.innerHTML = arr.map(i => {
        if(!i.available) return `<div class="m-card" style="opacity:0.5"><span class="m-n">${i.name}</span><span class="m-c">Unavailable</span></div>`;
        const up = parseFloat(i.change) >= 0;
        const fPrice = formatMoney(i.price, i.currency);
        return `<div class="m-card" style="border-left: 3px solid ${up?'var(--color-green)':'var(--color-red)'}">
          <span class="m-n">${i.name}</span>
          <span class="m-p">${fPrice}</span>
          <span class="m-c" style="color:${up?'var(--color-green)':'var(--color-red)'}">${up?'+':''}${i.change} (${i.changePercent}%)</span>
        </div>`;
      }).join('');
    }

    bHeat(m.indices, 'heat-indices'); bCards(m.indices, 'cards-indices');
    bHeat(m.sectors, 'heat-sectors'); bCards(m.sectors, 'cards-sectors');
    bHeat(m.commodities, 'heat-commodities'); bCards(m.commodities, 'cards-commodities');
    bHeat(m.currencies, 'heat-currencies'); bCards(m.currencies, 'cards-currencies');
    bHeat(m.crypto, 'heat-crypto'); bCards(m.crypto, 'cards-crypto');
  }

  // ── Regions Outlook ──
  function renderRegionsView() {
    if(!state.regions) return;
    $('grid-regions').innerHTML = state.regions.map(r => {
      const risk = r.outlook?.riskLevel || '';
      const rCl = risk.toLowerCase().includes('elevated') ? 'color:var(--color-red)' : risk.toLowerCase().includes('moderate') ? 'color:var(--color-amber)' : 'color:var(--color-green)';
      
      const cats = r.outlook?.categories?.map(c => `
        <div class="out-cat">
          <h5>${c.icon} ${c.name}</h5>
          <ul>${c.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
        </div>
      `).join('') || '';

      return `
        <div class="region-card">
          <div class="rc-header">
            <div class="rc-title">${r.emoji} ${r.name}</div>
            <div class="risk-shield" style="${rCl}">${risk}</div>
          </div>
          <div class="rc-body">${cats}</div>
        </div>
      `;
    }).join('');
  }

  // ── Global Article Modal ──
  window.viewArticle = function(id) {
    const a = state.allArticles.find(x => x.id === id);
    if(!a) return;

    const c = getColor(a.impactScore);
    $('mdl-cat').textContent = a.category;
    $('mdl-src').textContent = a.source;
    $('mdl-date').textContent = new Date(a.publishedAt).toLocaleString();
    
    const shld = $('mdl-shield');
    shld.style.borderColor = c;
    $('mdl-impact').style.color = c;
    $('mdl-impact').textContent = a.impactScore;
    
    $('mdl-title').textContent = a.title;
    $('mdl-summary').textContent = a.summary || a.content || 'Insufficient data for summary.';
    
    const bul = $('mdl-bullets');
    if(a.bullets && a.bullets.length) {
      bul.innerHTML = `<ul>${a.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`;
    } else {
      bul.innerHTML = '';
    }

    $('mdl-link').href = a.link;

    $('article-modal').classList.add('active');
  };

  function closeModal() {
    $('article-modal').classList.remove('active');
  }

  // ── Utils ──
  function formatMoney(amount, currency) {
    if (amount == null || amount === '') return '';
    const symbolMap = { 'USD': '$', 'GBP': '£', 'EUR': '€', 'JPY': '¥', 'CNY': '¥', 'AUD': 'A$', 'CAD': 'C$', 'CHF': 'CHF ' };
    const sym = symbolMap[currency] || (currency ? currency + ' ' : '');
    return `${sym}${amount}`;
  }
  
  function getColor(s) { return s>=8 ? 'var(--color-red)' : s>=6 ? 'var(--color-amber)' : s>=4 ? 'var(--color-cyan)' : 'var(--color-green)'; }
  function getHeatColor(pct) {
    if(pct>=2) return 'rgba(46,160,67,0.8)'; if(pct>=0.5) return 'rgba(46,160,67,0.4)'; if(pct>=0) return 'rgba(46,160,67,0.15)';
    if(pct<=-2) return 'rgba(248,81,73,0.8)'; if(pct<=-0.5) return 'rgba(248,81,73,0.4)'; return 'rgba(248,81,73,0.15)';
  }
  function tAgo(d) {
    const m = Math.floor((Date.now() - new Date(d).getTime())/60000);
    if(m<60) return `${m||1}m ago`;
    const h = Math.floor(m/60);
    if(h<24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }
  function esc(t) { const el = document.createElement('span'); el.textContent = t||''; return el.innerHTML; }
  function debounce(f, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>f(...a), ms); }; }
  
  function initLoadState() {
    // Fill empty divs with skeletons until loaded
    qa('.news-grid').forEach(g => {
      g.innerHTML = Array(6).fill().map(()=>`<div class="news-card skeleton" style="height:200px"></div>`).join('');
    });
  }

  function startClocks() {
    setInterval(() => {
      $('world-clocks').innerHTML = CLOCKS.map(c => {
        const t = new Date().toLocaleTimeString('en-US',{timeZone:c.tz, hour12:false, hour:'2-digit', minute:'2-digit'});
        return `<div class="clock-row"><span class="clock-city">${c.city}</span><span>${t}</span></div>`;
      }).join('');
    }, 1000);
  }

  // Allow intel view rendering to be exposed
  window.renderIntelView = function() {
    if(!state.intelReport) return;
    const r = state.intelReport;
    
    const secs = r.sections ? Object.entries(r.sections).map(([k,v]) => `
      <div class="br-section">
        <div class="br-sec-title"><span>■</span> ${k} <span style="font-size:12px;color:var(--text-muted);font-weight:normal;margin-left:auto">Avg Impact: ${v.avgImpact} | Alerts: <span style="color:var(--color-red)">${v.criticalCount}</span></span></div>
        <div class="br-sec-body">${(v.briefing||'').replace(/\n/g,'<br>')}</div>
      </div>
    `).join('') : '';

    $('intel-briefing-doc').innerHTML = `
      <div class="br-header">
        <div class="br-label">Highly Classified • Executive Eyes Only</div>
        <div class="br-title">Situational Intelligence Briefing</div>
        <div style="color:var(--text-muted)">Generated for: ${r.period || 'Current Window'} | ${r.date}</div>
      </div>
      <div class="br-exec">
        <strong style="color:#fff">EXECUTIVE SUMMARY</strong><br><br>
        ${(r.executiveSummary||'').replace(/\n/g, '<br>')}
      </div>
      <div class="br-details">${secs}</div>
    `;
  };

  document.addEventListener('DOMContentLoaded', init);
})();
