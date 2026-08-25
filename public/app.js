/**
 * EconIntel dashboard.
 *
 * Plain modules and hand-built SVG — no framework, no chart library. The page
 * draws a handful of line charts over data the server has already shaped, and a
 * bundled charting library would be larger than everything here put together
 * while giving less control over the axis and hover behaviour.
 *
 * Charts follow the dataviz rules: fixed categorical order (never cycled), one
 * y-axis per chart, a legend whenever more than one series is drawn, tabular
 * figures, and a crosshair tooltip as standard rather than as an extra.
 */

const API = '';

/**
 * The validated categorical order. Assigned by position and never cycled: a
 * ninth series would fold into "other" rather than reusing hue one, because a
 * repeated colour reads as a repeated entity.
 */
const SERIES_COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];

const state = {
  view: 'dashboard',
  pillar: null,
  indicators: [],
  pillars: [],
  status: null,
  cache: new Map(),
};

/* ── utilities ─────────────────────────────────────────────────────────────*/

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

async function api(path) {
  if (state.cache.has(path)) return state.cache.get(path);
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  const data = await res.json();
  state.cache.set(path, data);
  return data;
}

/** Locale-aware, and compact only above 10,000 so ordinary figures stay exact. */
function fmt(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return (value / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return (value / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (abs >= 1e4) return (value / 1e3).toFixed(1) + 'k';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: abs < 10 ? decimals : 0,
    maximumFractionDigits: abs < 10 ? decimals : 1,
  });
}

function fmtDate(iso, cadence) {
  const d = new Date(iso + 'T00:00:00Z');
  if (cadence === 'annual') return String(d.getUTCFullYear());
  if (cadence === 'quarterly') return `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Work out cadence from the observations themselves.
 *
 * The declared cadence on an indicator is metadata, and metadata drifts: several
 * series here are annual in fact while declared quarterly or monthly, which put
 * "vs 2015 Q1" under a figure whose points are years apart. The source audit
 * found the same thing upstream — RBA series tagged daily that are quarterly —
 * so the dates are the only trustworthy statement of spacing.
 */
function inferCadence(points) {
  const dates = points.filter((p) => p.value != null).map((p) => p.date);
  if (dates.length < 2) return 'annual';
  const gaps = [];
  for (let i = 1; i < Math.min(dates.length, 8); i += 1) {
    gaps.push((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median > 200) return 'annual';
  if (median > 60) return 'quarterly';
  if (median > 20) return 'monthly';
  if (median > 4) return 'weekly';
  return 'daily';
}

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ── sparkline ─────────────────────────────────────────────────────────────*/

/**
 * A sparkline carries shape only — no axes, no labels, no tooltip. It sits
 * beside a number that already states the value, so adding scales would repeat
 * what the tile says and crowd what the line is for.
 */
function sparkline(points, colorVar = '--accent') {
  const W = 200, H = 30, PAD = 2;
  const values = points.map((p) => p.value).filter((v) => v != null);
  if (values.length < 2) return '';

  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = (W - PAD * 2) / (values.length - 1);

  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(PAD + i * step).toFixed(1)},${(H - PAD - ((v - min) / span) * (H - PAD * 2)).toFixed(1)}`)
    .join(' ');

  const last = values[values.length - 1];
  const cx = PAD + (values.length - 1) * step;
  const cy = H - PAD - ((last - min) / span) * (H - PAD * 2);

  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(${colorVar})" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="var(${colorVar})"/>
  </svg>`;
}

/* ── line chart ────────────────────────────────────────────────────────────*/

/**
 * Multi-series line chart with a crosshair tooltip.
 *
 * ONE y-axis, always. Series measured on different scales are indexed to a
 * common base before they arrive here — a second axis lets any two lines be
 * made to cross wherever the author wants, which is the most effective way to
 * imply a relationship that is not in the data.
 */
function lineChart(container, series, { cadence = 'monthly', unit = '', height = 260 } = {}) {
  container.innerHTML = '';
  const live = series.filter((s) => s.points.some((p) => p.value != null));
  if (!live.length) {
    container.appendChild(el('div', 'empty', 'No data for this selection.'));
    return;
  }

  const W = 760, H = height;
  const M = { top: 14, right: 16, bottom: 26, left: 52 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const all = live.flatMap((s) => s.points.filter((p) => p.value != null));
  const dates = [...new Set(all.map((p) => p.date))].sort();
  const values = all.map((p) => p.value);

  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  // Pad the range so the extremes are not welded to the frame.
  const allNonNegative = values.every((v) => v >= 0);
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  // Include zero only when the data is already close to it. Forcing a zero
  // baseline onto an index that lives near 120 flattens every real movement.
  if (lo > 0 && lo < (hi - lo) * 0.4) lo = 0;
  // Never show a negative axis for a quantity that cannot be negative. Padding
  // below zero on a percentage puts "-4.3%" on the scale, which is not a
  // cosmetic flaw — it asserts that a negative share is a possible reading.
  if (allNonNegative && lo < 0) lo = 0;

  const x = (iso) => (dates.indexOf(iso) / Math.max(dates.length - 1, 1)) * iw;
  const y = (v) => ih - ((v - lo) / (hi - lo)) * ih;

  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    `Line chart, ${live.length} series, ${fmtDate(dates[0], cadence)} to ${fmtDate(dates[dates.length - 1], cadence)}.`);

  const g = document.createElementNS(svgns, 'g');
  g.setAttribute('transform', `translate(${M.left},${M.top})`);
  svg.appendChild(g);

  // Horizontal gridlines only. Vertical ones add ink without helping a reader
  // who is comparing heights.
  const TICKS = 5;
  for (let i = 0; i <= TICKS; i += 1) {
    const v = lo + ((hi - lo) * i) / TICKS;
    const gy = y(v);
    const line = document.createElementNS(svgns, 'line');
    line.setAttribute('class', 'gridline');
    line.setAttribute('x1', 0); line.setAttribute('x2', iw);
    line.setAttribute('y1', gy); line.setAttribute('y2', gy);
    g.appendChild(line);

    const label = document.createElementNS(svgns, 'text');
    label.setAttribute('class', 'axis');
    label.setAttribute('x', -8); label.setAttribute('y', gy + 3.5);
    label.setAttribute('text-anchor', 'end');
    label.textContent = fmt(v);
    g.appendChild(label);
  }

  // Roughly six x labels, chosen by stride so they never collide.
  const stride = Math.max(1, Math.ceil(dates.length / 6));
  dates.forEach((iso, i) => {
    if (i % stride !== 0 && i !== dates.length - 1) return;
    const t = document.createElementNS(svgns, 'text');
    t.setAttribute('class', 'axis');
    t.setAttribute('x', x(iso)); t.setAttribute('y', ih + 17);
    t.setAttribute('text-anchor', i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle');
    t.textContent = fmtDate(iso, cadence);
    g.appendChild(t);
  });

  live.forEach((s, i) => {
    const color = `var(${SERIES_COLORS[i % SERIES_COLORS.length]})`;
    const pts = s.points.filter((p) => p.value != null);
    // Break the path across gaps rather than bridging them: a straight line
    // over missing months asserts data that was never collected.
    let d = '';
    let prevIndex = null;
    for (const p of pts) {
      const idx = dates.indexOf(p.date);
      d += (prevIndex === null || idx !== prevIndex + 1 ? 'M' : 'L') + `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)} `;
      prevIndex = idx;
    }
    const path = document.createElementNS(svgns, 'path');
    path.setAttribute('class', 'series-line');
    path.setAttribute('d', d.trim());
    path.setAttribute('stroke', color);
    path.dataset.series = String(i);
    g.appendChild(path);
  });

  // Hover layer
  const crosshair = document.createElementNS(svgns, 'line');
  crosshair.setAttribute('class', 'crosshair');
  crosshair.setAttribute('y1', 0); crosshair.setAttribute('y2', ih);
  crosshair.style.opacity = '0';
  g.appendChild(crosshair);

  const dots = live.map(() => {
    const c = document.createElementNS(svgns, 'circle');
    c.setAttribute('class', 'hover-dot');
    c.setAttribute('r', 4);
    c.style.opacity = '0';
    g.appendChild(c);
    return c;
  });

  const wrap = el('div', 'chart-wrap');
  wrap.appendChild(svg);
  const tip = el('div', 'tooltip');
  wrap.appendChild(tip);
  container.appendChild(wrap);

  svg.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W - M.left;
    const idx = Math.round((px / iw) * (dates.length - 1));
    if (idx < 0 || idx >= dates.length) return;
    const iso = dates[idx];
    const cx = x(iso);

    crosshair.setAttribute('x1', cx); crosshair.setAttribute('x2', cx);
    crosshair.style.opacity = '1';

    let html = `<div class="tooltip-date">${fmtDate(iso, cadence)}</div>`;
    live.forEach((s, i) => {
      const p = s.points.find((q) => q.date === iso && q.value != null);
      if (p) {
        dots[i].setAttribute('cx', cx);
        dots[i].setAttribute('cy', y(p.value));
        dots[i].setAttribute('fill', `var(${SERIES_COLORS[i % SERIES_COLORS.length]})`);
        dots[i].style.opacity = '1';
        html += `<div class="tooltip-row">
          <span class="legend-swatch" style="background:var(${SERIES_COLORS[i % SERIES_COLORS.length]})"></span>
          <span>${s.label}</span>
          <span class="tooltip-val">${fmt(p.value)}${unit ? ' ' + unit : ''}</span>
        </div>`;
      } else {
        dots[i].style.opacity = '0';
      }
    });

    tip.innerHTML = html;
    tip.classList.add('on');
    const left = Math.min(Math.max((cx + M.left) / W * box.width - 64, 4), box.width - 150);
    tip.style.left = `${left}px`;
    tip.style.top = `8px`;
  });

  svg.addEventListener('pointerleave', () => {
    crosshair.style.opacity = '0';
    dots.forEach((d) => { d.style.opacity = '0'; });
    tip.classList.remove('on');
  });

  // A legend appears whenever more than one series is drawn, so identity never
  // rests on colour alone. A single series is named by the card title instead.
  if (live.length > 1) {
    const legend = el('div', 'legend');
    live.forEach((s, i) => {
      const item = el('button', 'legend-item');
      item.type = 'button';
      item.setAttribute('aria-pressed', 'true');
      item.innerHTML = `<span class="legend-swatch" style="background:var(${SERIES_COLORS[i % SERIES_COLORS.length]})"></span>${s.label}`;
      item.addEventListener('click', () => {
        const on = item.getAttribute('aria-pressed') === 'true';
        item.setAttribute('aria-pressed', String(!on));
        const path = g.querySelector(`path[data-series="${i}"]`);
        if (path) path.style.display = on ? 'none' : '';
      });
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }
}

/* ── data helpers ──────────────────────────────────────────────────────────*/

async function loadSeries(id, country) {
  const q = country ? `?country=${encodeURIComponent(country)}` : '';
  const data = await api(`/api/indicators/${encodeURIComponent(id)}/observations${q}`);
  return {
    meta: data.indicator,
    points: data.observations.map((o) => ({ date: o.period_start, value: o.value })),
  };
}

/**
 * Change over a RECENT window, not since the beginning of the series.
 *
 * "Since Jan 1990" is not a fact a dashboard reader wants, and comparing a
 * present value against a tiny historical base produces numbers like "+67,232%"
 * that are arithmetically correct and read as a bug. Data-centre capacity really
 * did go from ~3 MW to ~1,946 MW; saying so as a percentage helps nobody.
 *
 * So the window is the last three years' worth of observations, sized by
 * cadence, falling back to the whole series when it is shorter than that.
 *
 * A RATE is reported in percentage POINTS. The share of filings mentioning AI
 * moving 17.6% to 60.9% is +43.3 points; calling it "+246%" invites the reader
 * to think three times as many filings exist, which is a different claim.
 *
 * @param {{date:string,value:number|null}[]} points
 * @param {boolean} isRate
 * @param {string} cadence
 */
function delta(points, isRate, cadence = 'monthly') {
  const vals = points.filter((p) => p.value != null);
  if (vals.length < 2) return null;

  const window = cadence === 'annual' ? 3 : cadence === 'quarterly' ? 12 : 36;
  const from = vals[Math.max(0, vals.length - 1 - window)];
  const to = vals[vals.length - 1];
  if (from === to) return null;

  const since = fmtDate(from.date, cadence);
  if (isRate) return { value: to.value - from.value, unit: 'pp', since };

  if (!from.value) return null;
  const ratio = to.value / from.value;
  // Past a tripling, a multiple is easier to read than a percentage and does
  // not run to five digits.
  if (ratio >= 3) return { value: ratio, unit: '\u00d7', since, multiple: true };
  return { value: ((to.value - from.value) / Math.abs(from.value)) * 100, unit: '%', since };
}

function deltaBadge(d) {
  if (d == null || !Number.isFinite(d.value)) return '<span class="delta flat">—</span>';
  /**
   * The flat threshold is deliberately tiny.
   *
   * At 0.5 a fall of 0.2 percentage points was classed "flat", drew a sideways
   * arrow, and had its sign removed by Math.abs below — so a decline rendered
   * as "→ 0.2pp" and read as a rise. On the information-sector employment tile
   * that inverted the most interesting finding in the dataset.
   *
   * A change counts as flat only when it is genuinely nil. The arrow carries
   * direction alongside the colour, since colour alone fails for a colour-blind
   * reader and in print.
   */
  const cls = d.value > 0.001 ? 'up' : d.value < -0.001 ? 'down' : 'flat';
  const arrow = cls === 'up' ? '↑' : cls === 'down' ? '↓' : '→';
  const mag = Math.abs(d.value);
  if (d.multiple) return `<span class="delta up">\u2191 ${d.value.toFixed(1)}\u00d7</span>`;
  const shown = mag >= 1000 ? fmt(mag, 0) : mag.toFixed(1);
  return `<span class="delta ${cls}">${arrow} ${shown}${d.unit}</span>`;
}

/* ── views ─────────────────────────────────────────────────────────────────*/

/** Headline tiles. Chosen because each is the clearest number in its pillar. */
const HEADLINES = [
  { id: 'derived.sec_ai_mention_rate', country: 'USA', label: 'US filings mentioning AI', unit: '%', note: 'share of 10-K filings' },
  { id: 'derived.datacentre_capacity_mw', country: 'USA', label: 'US data-centre capacity', unit: 'MW', note: 'known clusters, lower bound' },
  { id: 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T.S_GE10', country: null, label: 'EU firms using AI', unit: '%', note: 'enterprises, 10+ staff' },
  { id: 'derived.information_employment_share', country: 'USA', label: 'US information-sector jobs', unit: '%', note: 'share of all employment' },
];

async function viewDashboard(root) {
  root.innerHTML = '';

  const statRow = el('div', 'stat-row');
  HEADLINES.forEach(() => {
    const s = el('div', 'stat');
    s.innerHTML = `<div class="skeleton" style="height:11px;width:60%"></div>
      <div class="skeleton" style="height:23px;width:45%;margin-top:8px"></div>
      <div class="skeleton" style="height:30px;margin-top:9px"></div>`;
    statRow.appendChild(s);
  });
  root.appendChild(statRow);

  const grid = el('div', 'grid two');
  root.appendChild(grid);

  // Charts
  const adoptionCard = card('AI adoption is measurable now', 'Share of firms and filings referring to AI');
  const infraCard = card('The physical build-out', 'Known data-centre capacity, cumulative megawatts');
  grid.appendChild(adoptionCard.card);
  grid.appendChild(infraCard.card);

  const grid2 = el('div', 'grid two-one');
  grid2.style.marginTop = '12px';
  root.appendChild(grid2);

  const effectsCard = card('Effects on work', 'Information-sector employment as a share of the whole economy');
  const newsCard = card('Latest AI-economics news', 'Filtered for relevance, scored 0–100');
  grid2.appendChild(effectsCard.card);
  grid2.appendChild(newsCard.card);
  newsCard.body.classList.add('flush');

  // Fill tiles
  const tiles = await Promise.all(HEADLINES.map(async (h) => {
    try {
      const s = await loadSeries(h.id, h.country);
      return { h, s };
    } catch { return { h, s: null }; }
  }));

  statRow.innerHTML = '';
  tiles.forEach(({ h, s }, i) => {
    const tile = el('div', 'stat');
    if (!s || !s.points.length) {
      tile.innerHTML = `<div class="stat-label">${h.label}</div>
        <div class="stat-value">—</div><div class="stat-note">no data yet</div>`;
    } else {
      const vals = s.points.filter((p) => p.value != null);
      const last = vals[vals.length - 1];
      tile.innerHTML = `<div class="stat-label">${h.label}</div>
        <div class="stat-value">${fmt(last.value)}<small>${h.unit}</small></div>
        <div class="stat-foot">${(() => { const cad = inferCadence(s.points); const dd = delta(s.points, h.unit === '%', cad); return deltaBadge(dd) + (dd ? `<span class="stat-note">vs ${dd.since}</span>` : ''); })()}</div>
        ${sparkline(s.points, SERIES_COLORS[i % SERIES_COLORS.length])}
        <div class="stat-note" style="margin-top:5px">${h.note}</div>`;
    }
    statRow.appendChild(tile);
  });

  // Adoption chart — two comparable percentage series, so they share one axis.
  try {
    const [sec, eu] = await Promise.all([
      loadSeries('derived.sec_ai_mention_rate', 'USA'),
      loadSeries('dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T.S_GE10', null),
    ]);
    lineChart(adoptionCard.body, [
      { label: 'US 10-K filings mentioning AI', points: sec.points },
      { label: 'EU enterprises using AI', points: eu.points },
    ], { cadence: inferCadence(sec.points), unit: '%' });
  } catch (e) { adoptionCard.body.appendChild(el('div', 'err', 'Could not load: ' + e.message)); }

  try {
    const cap = await loadSeries('derived.datacentre_capacity_mw', 'USA');
    lineChart(infraCard.body, [{ label: 'US known capacity', points: cap.points }],
      { cadence: inferCadence(cap.points), unit: 'MW' });
  } catch (e) { infraCard.body.appendChild(el('div', 'err', 'Could not load: ' + e.message)); }

  try {
    const share = await loadSeries('derived.information_employment_share', 'USA');
    lineChart(effectsCard.body, [{ label: 'Information sector share', points: share.points }],
      { cadence: inferCadence(share.points), unit: '%' });
  } catch (e) { effectsCard.body.appendChild(el('div', 'err', 'Could not load: ' + e.message)); }

  try {
    const { documents } = await api('/api/documents?limit=9');
    if (!documents.length) newsCard.body.appendChild(el('div', 'empty', 'No articles yet.'));
    documents.forEach((d) => {
      const a = el('a', 'news-item');
      a.href = d.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `<div class="news-meta">
          <span class="score ${d.ai_relevance >= 70 ? 'hi' : ''}">${d.ai_relevance}</span>
          <span class="news-src">${d.source_name}</span>
        </div><div class="news-title">${escapeHtml(d.title)}</div>`;
      newsCard.body.appendChild(a);
    });
  } catch (e) { newsCard.body.appendChild(el('div', 'err', e.message)); }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function card(title, sub) {
  const c = el('div', 'card');
  const head = el('div', 'card-head');
  const wrap = el('div');
  wrap.appendChild(el('h2', 'card-title', title));
  if (sub) wrap.appendChild(el('p', 'card-sub', sub));
  head.appendChild(wrap);
  const body = el('div', 'card-body');
  c.appendChild(head); c.appendChild(body);
  return { card: c, head, body };
}

async function viewPillar(root, pillar) {
  root.innerHTML = '';
  const list = state.indicators.filter((i) => i.pillar === pillar && i.observation_count > 0);
  if (!list.length) {
    root.appendChild(el('div', 'empty', 'No populated indicators in this pillar yet.'));
    return;
  }

  const c = card(`${pillar[0].toUpperCase()}${pillar.slice(1)} indicators`, `${list.length} with data`);
  c.body.classList.add('flush');
  root.appendChild(c.card);

  const scroll = el('div', 'table-scroll');
  const table = el('table', 'table');
  table.innerHTML = `<thead><tr>
      <th scope="col">Indicator</th><th scope="col">Country</th>
      <th scope="col">Unit</th><th scope="col" class="num">Points</th>
      <th scope="col">Latest</th><th scope="col">Trend</th>
    </tr></thead>`;
  const tbody = el('tbody');
  table.appendChild(tbody);
  scroll.appendChild(table);
  c.body.appendChild(scroll);

  for (const ind of list) {
    const tr = el('tr');
    tr.innerHTML = `<td>${escapeHtml(ind.name)}</td>
      <td><span class="pill">${ind.default_country_iso3 || (ind.has_country_dim ? 'multi' : '—')}</span></td>
      <td style="color:var(--ink-3);font-size:12px">${escapeHtml(ind.unit || '')}</td>
      <td class="num">${ind.observation_count.toLocaleString()}</td>
      <td style="font-size:12px;color:var(--ink-3)">${ind.latest_period || '—'}</td>
      <td style="width:130px"></td>`;
    tbody.appendChild(tr);

    // Sparklines load lazily per row so a 40-row pillar does not fire 40
    // requests before anything renders.
    loadSeries(ind.id, ind.default_country_iso3 || undefined)
      .then((s) => { tr.lastElementChild.innerHTML = sparkline(s.points, '--c1'); })
      .catch(() => { tr.lastElementChild.textContent = '—'; });
  }
}

async function viewNews(root) {
  root.innerHTML = '';
  const c = card('AI-economics news', 'Scored by keyword relevance at ingestion — no model involved');
  c.body.classList.add('flush');
  root.appendChild(c.card);
  try {
    const { documents } = await api('/api/documents?limit=100');
    if (!documents.length) { c.body.appendChild(el('div', 'empty', 'No articles.')); return; }
    documents.forEach((d) => {
      const a = el('a', 'news-item');
      a.href = d.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const when = new Date(d.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      a.innerHTML = `<div class="news-meta">
          <span class="score ${d.ai_relevance >= 70 ? 'hi' : ''}">${d.ai_relevance}</span>
          <span class="news-src">${escapeHtml(d.source_name)}</span>
          <span class="news-src">· ${when}</span>
        </div><div class="news-title">${escapeHtml(d.title)}</div>`;
      c.body.appendChild(a);
    });
  } catch (e) { c.body.appendChild(el('div', 'err', e.message)); }
}

async function viewIndicators(root) {
  root.innerHTML = '';
  const c = card('All indicators', `${state.indicators.length} defined`);
  c.body.classList.add('flush');
  root.appendChild(c.card);

  const scroll = el('div', 'table-scroll');
  const table = el('table', 'table');
  table.innerHTML = `<thead><tr>
    <th scope="col">Indicator</th><th scope="col">Pillar</th>
    <th scope="col">Source</th><th scope="col" class="num">Points</th>
    <th scope="col">Range</th></tr></thead>`;
  const tbody = el('tbody');
  state.indicators.forEach((i) => {
    const tr = el('tr');
    const range = i.observation_count
      ? `${(i.earliest_period || '').slice(0, 4)}–${(i.latest_period || '').slice(0, 4)}`
      : '—';
    tr.innerHTML = `<td>${escapeHtml(i.name)}</td>
      <td><span class="pill">${i.pillar}</span></td>
      <td style="font-size:12px;color:var(--ink-3)">${escapeHtml(i.source_id)}</td>
      <td class="num">${i.observation_count ? i.observation_count.toLocaleString() : '<span style="color:var(--ink-3)">0</span>'}</td>
      <td style="font-size:12px;color:var(--ink-3)">${range}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  c.body.appendChild(scroll);
}

async function viewStatus(root) {
  root.innerHTML = '';
  const s = state.status;

  const row = el('div', 'stat-row');
  [['Observations', s.counts.observations], ['News articles', s.counts.documents],
   ['Indicators', s.counts.indicators], ['Countries', s.counts.countries]]
    .forEach(([label, value]) => {
      const t = el('div', 'stat');
      t.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value.toLocaleString()}</div>`;
      row.appendChild(t);
    });
  root.appendChild(row);

  const grid = el('div', 'grid two');
  root.appendChild(grid);

  const intg = card('Data sources', 'What is configured and what is not');
  intg.body.classList.add('flush');
  const it = el('table', 'table');
  it.innerHTML = '<thead><tr><th scope="col">Source</th><th scope="col">State</th><th scope="col">Note</th></tr></thead>';
  const ib = el('tbody');
  s.integrations.forEach((i) => {
    const tr = el('tr');
    tr.innerHTML = `<td>${escapeHtml(i.name)}</td>
      <td><span class="pill ${i.ready ? 'ok' : 'warn'}">${i.ready ? 'ready' : 'not configured'}</span></td>
      <td style="font-size:11.5px;color:var(--ink-3)">${escapeHtml(i.note)}</td>`;
    ib.appendChild(tr);
  });
  it.appendChild(ib);
  intg.body.appendChild(el('div', 'table-scroll')).appendChild(it);
  grid.appendChild(intg.card);

  const runs = card('Recent ingestion runs', 'Failures are shown, not hidden');
  runs.body.classList.add('flush');
  const rt = el('table', 'table');
  rt.innerHTML = '<thead><tr><th scope="col">Job</th><th scope="col">Result</th><th scope="col" class="num">Rows</th></tr></thead>';
  const rb = el('tbody');
  s.recentRuns.forEach((r) => {
    const tr = el('tr');
    const cls = r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'off' : 'warn';
    tr.innerHTML = `<td style="font-size:12px">${escapeHtml(r.job_name)}</td>
      <td><span class="pill ${cls}">${r.status}</span></td>
      <td class="num">${r.rows_written ?? 0}</td>`;
    rb.appendChild(tr);
  });
  rt.appendChild(rb);
  runs.body.appendChild(el('div', 'table-scroll')).appendChild(rt);
  grid.appendChild(runs.card);
}

/* ── routing & boot ────────────────────────────────────────────────────────*/

const TITLES = {
  dashboard: ['Dashboard', 'AI’s measurable effect on the world economy'],
  news: ['News', 'Relevance-filtered AI economics coverage'],
  indicators: ['All indicators', 'Every series defined, populated or not'],
  status: ['Pipeline status', 'What ran, what failed, what is stale'],
};

async function render() {
  const root = $('#view');
  root.innerHTML = '<div class="loading">Loading…</div>';

  const [title, sub] = state.view === 'pillar'
    ? [`${state.pillar[0].toUpperCase()}${state.pillar.slice(1)}`,
       state.pillars.find((p) => p.pillar === state.pillar)
         ? `${state.pillars.find((p) => p.pillar === state.pillar).observation_count.toLocaleString()} observations`
         : '']
    : TITLES[state.view];

  $('#page-title').textContent = title;
  $('#page-sub').textContent = sub;

  try {
    if (state.view === 'dashboard') await viewDashboard(root);
    else if (state.view === 'pillar') await viewPillar(root, state.pillar);
    else if (state.view === 'news') await viewNews(root);
    else if (state.view === 'indicators') await viewIndicators(root);
    else if (state.view === 'status') await viewStatus(root);
  } catch (e) {
    root.innerHTML = '';
    root.appendChild(el('div', 'err', 'Failed to render: ' + e.message));
  }
}

function wireNav() {
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'page');
      state.view = btn.dataset.view;
      state.pillar = btn.dataset.pillar ?? null;
      render();
    });
  });

  $('#refresh-btn').addEventListener('click', () => { state.cache.clear(); boot(); });

  const toggle = $('#theme-toggle');
  const apply = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    $('#theme-label').textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    try { localStorage.setItem('econintel-theme', mode); } catch { /* private mode */ }
  };
  let stored = null;
  try { stored = localStorage.getItem('econintel-theme'); } catch { /* ignore */ }
  apply(stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  toggle.addEventListener('click', () =>
    apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  const bar = $('#topbar');
  addEventListener('scroll', () => bar.classList.toggle('stuck', scrollY > 4), { passive: true });
}

async function boot() {
  try {
    const [inds, pills, status] = await Promise.all([
      api('/api/indicators'), api('/api/pillars'), api('/api/status'),
    ]);
    state.indicators = inds.indicators;
    state.pillars = pills.pillars;
    state.status = status;

    pills.pillars.forEach((p) => {
      const n = document.querySelector(`[data-count="${p.pillar}"]`);
      if (n) n.textContent = p.populated_count;
    });
    const all = document.querySelector('[data-count="all"]');
    if (all) all.textContent = inds.indicators.length;
    const news = document.querySelector('[data-count="news"]');
    if (news) news.textContent = status.counts.documents;

    await render();
  } catch (e) {
    $('#view').innerHTML = '';
    $('#view').appendChild(el('div', 'err',
      `Cannot reach the API (${e.message}). Is the server running on port 3000?`));
  }
}

wireNav();
boot();
