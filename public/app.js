/**
 * EconIntel — question-led dashboard.
 *
 * The organising idea: a page answers a question, and every chart on it exists
 * to support that answer. Both the answer and the reason each chart is present
 * are stored text, fetched from /api/questions — not written here, and not
 * generated. The front end arranges evidence; it does not author claims.
 *
 * Reader mode switches which register of that stored text is shown. The
 * technical variant is not the plain one with jargon added; it answers a
 * different question, usually how a thing was measured and where it misleads.
 *
 * Charts are hand-built SVG. A chart library would be larger than this whole
 * file and would fight the two rules that matter here: one y-axis always, and
 * a click on a point opens the news from that month.
 */

/** Validated categorical order — see the note in style.css. Never reordered. */
const SERIES_COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];

const state = {
  view: 'question',
  slug: 'adoption',
  mode: 'plain',
  questions: [],
  indicators: [],
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
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path) {
  if (state.cache.has(path)) return state.cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  const data = await res.json();
  state.cache.set(path, data);
  return data;
}

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
 * Cadence from the observations, not from the indicator's own metadata.
 *
 * Several series are annual in fact while declared quarterly, which put
 * "vs 2015 Q1" under points a year apart. The upstream audit found the same
 * problem at source — RBA series tagged daily that are quarterly — so the
 * dates are the only trustworthy statement of spacing.
 */
function inferCadence(points) {
  const dates = points.filter((p) => p.value != null).map((p) => p.date);
  if (dates.length < 2) return 'annual';
  const gaps = [];
  for (let i = 1; i < Math.min(dates.length, 8); i += 1) {
    gaps.push((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
  }
  gaps.sort((a, b) => a - b);
  const m = gaps[Math.floor(gaps.length / 2)];
  return m > 200 ? 'annual' : m > 60 ? 'quarterly' : m > 20 ? 'monthly' : m > 4 ? 'weekly' : 'daily';
}

/**
 * Change over a trailing window. A RATE is reported in percentage POINTS:
 * a share moving 0.5% to 60.9% is +60.4 points, and "+11,831%" is
 * arithmetically true, useless, and reads as a bug.
 */
function delta(points, isRate, cadence) {
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
  if (ratio >= 3) return { value: ratio, unit: '×', since, multiple: true };
  return { value: ((to.value - from.value) / Math.abs(from.value)) * 100, unit: '%', since };
}

function deltaBadge(d) {
  if (d == null || !Number.isFinite(d.value)) return '<span class="delta flat">—</span>';
  // Flat only when genuinely nil. At a wider threshold a small FALL was classed
  // flat and had its sign stripped, so a decline read as a rise.
  const cls = d.value > 0.001 ? 'up' : d.value < -0.001 ? 'down' : 'flat';
  const arrow = cls === 'up' ? '↑' : cls === 'down' ? '↓' : '→';
  if (d.multiple) return `<span class="delta up">↑ ${d.value.toFixed(1)}×</span>`;
  const mag = Math.abs(d.value);
  return `<span class="delta ${cls}">${arrow} ${mag >= 1000 ? fmt(mag, 0) : mag.toFixed(1)}${d.unit}</span>`;
}

const isRateUnit = (unit) => /%|percent|share|rate|pp/i.test(unit ?? '');

/* ── sparkline ─────────────────────────────────────────────────────────────*/

function sparkline(points, colorVar = '--accent') {
  const W = 200, H = 30, PAD = 2;
  const values = points.map((p) => p.value).filter((v) => v != null);
  if (values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = (W - PAD * 2) / (values.length - 1);
  const d = values.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${(PAD + i * step).toFixed(1)},${(H - PAD - ((v - min) / span) * (H - PAD * 2)).toFixed(1)}`
  ).join(' ');
  const last = values[values.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(${colorVar})" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${(PAD + (values.length - 1) * step).toFixed(1)}" cy="${(H - PAD - ((last - min) / span) * (H - PAD * 2)).toFixed(1)}" r="2" fill="var(${colorVar})"/>
  </svg>`;
}

/* ── line chart ────────────────────────────────────────────────────────────*/

/**
 * Multi-series line chart with crosshair, tooltip and click-to-context.
 *
 * ONE y-axis, always. Series on different scales are indexed server-side to a
 * common base before arriving; a second axis would let any two lines be made to
 * cross wherever we chose.
 *
 * @param {Function} [onPick] called with an ISO date when a point is clicked
 */
function lineChart(container, series, { cadence = 'monthly', unit = '', height = 250, width = 760, onPick = null } = {}) {
  container.innerHTML = '';
  const live = series.filter((s) => s.points.some((p) => p.value != null));
  if (!live.length) {
    container.appendChild(el('div', 'empty', 'No data for this selection.'));
    return;
  }

  const W = width, H = height;
  const M = { top: 14, right: 16, bottom: 26, left: 54 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const all = live.flatMap((s) => s.points.filter((p) => p.value != null));
  const dates = [...new Set(all.map((p) => p.date))].sort();
  const values = all.map((p) => p.value);

  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const allNonNegative = values.every((v) => v >= 0);
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  if (lo > 0 && lo < (hi - lo) * 0.4) lo = 0;
  // A share cannot be negative; padding below zero would put "-4.3%" on the
  // axis, which asserts that a negative share is a readable value.
  if (allNonNegative && lo < 0) lo = 0;

  const x = (iso) => (dates.indexOf(iso) / Math.max(dates.length - 1, 1)) * iw;
  const y = (v) => ih - ((v - lo) / (hi - lo)) * ih;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    `${live.length} series from ${fmtDate(dates[0], cadence)} to ${fmtDate(dates.at(-1), cadence)}.`);
  if (onPick) svg.classList.add('clickable');

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', `translate(${M.left},${M.top})`);
  svg.appendChild(g);

  /**
   * Tick precision from the RANGE, not a fixed one decimal.
   *
   * Japan's job-openings ratio spans 1.18 to 1.36. At one decimal the six ticks
   * printed 1.2, 1.2, 1.3, 1.3, 1.4 — three visibly duplicated labels on a
   * chart whose whole story is the movement between them. Enough decimals are
   * used to keep adjacent ticks distinct.
   */
  const tickStep = (hi - lo) / 5;
  const tickDecimals = tickStep >= 10 ? 0 : tickStep >= 1 ? 1 : tickStep >= 0.1 ? 2 : 3;

  for (let i = 0; i <= 5; i += 1) {
    const v = lo + ((hi - lo) * i) / 5;
    const gy = y(v);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'gridline');
    line.setAttribute('x1', 0); line.setAttribute('x2', iw);
    line.setAttribute('y1', gy); line.setAttribute('y2', gy);
    g.appendChild(line);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'axis');
    t.setAttribute('x', -8); t.setAttribute('y', gy + 3.5);
    t.setAttribute('text-anchor', 'end');
    t.textContent = Math.abs(v) >= 1e4
      ? fmt(v)
      : v.toLocaleString(undefined, { minimumFractionDigits: tickDecimals, maximumFractionDigits: tickDecimals });
    g.appendChild(t);
  }

  /**
   * Roughly six x labels, chosen by stride, with the last always shown.
   *
   * The guard matters: when the final index is not a multiple of the stride,
   * the last label and the one before it can land within a few pixels and
   * overprint — "2024 Q1" and "2025 Q3" rendered as "202Q025 Q3". Dropping the
   * penultimate label when it is too close is better than dropping the last,
   * which is the one a reader looks for first.
   */
  /**
   * X labels: as many as actually fit, never overlapping.
   *
   * Two earlier attempts failed here. A fixed six labels collided once the
   * supporting charts got a narrower viewBox — 390px of axis cannot hold six
   * labels roughly 62px wide. A guard that only checked the final pair then
   * missed collisions at the start.
   *
   * So: pick a target from the available width, then walk the candidates and
   * keep one only if it clears the last kept label. The final label is always
   * kept and wins any conflict, because it is the one a reader looks for first.
   */
  // 88 viewBox units. Measured against the longest labels this renders —
  // "Sept 2007" and "2022 Q3" — with clearance, after 64 and 62 both left
  // adjacent labels touching. Fewer, legible labels beat more, overlapping ones.
  const LABEL_PX = 88;
  const lastIndex = dates.length - 1;
  const target = Math.max(2, Math.floor(iw / (LABEL_PX + 14)));
  const stride = Math.max(1, Math.ceil(dates.length / target));

  const candidates = [];
  for (let i = 0; i <= lastIndex; i += stride) candidates.push(i);
  if (candidates.at(-1) !== lastIndex) candidates.push(lastIndex);

  const keep = [];
  for (const i of candidates) {
    if (i === lastIndex) {
      // Drop whatever the last label would overprint, not the last label.
      while (keep.length && Math.abs(x(dates[i]) - x(dates[keep.at(-1)])) < LABEL_PX) keep.pop();
      keep.push(i);
      break;
    }
    if (!keep.length || Math.abs(x(dates[i]) - x(dates[keep.at(-1)])) >= LABEL_PX) keep.push(i);
  }

  keep.forEach((i) => {
    const iso = dates[i];
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'axis');
    t.setAttribute('x', x(iso)); t.setAttribute('y', ih + 17);
    t.setAttribute('text-anchor', i === 0 ? 'start' : i === lastIndex ? 'end' : 'middle');
    t.textContent = fmtDate(iso, cadence);
    g.appendChild(t);
  });

  live.forEach((s, i) => {
    const color = `var(${SERIES_COLORS[i % SERIES_COLORS.length]})`;
    let d = '', prev = null;
    for (const p of s.points.filter((q) => q.value != null)) {
      const idx = dates.indexOf(p.date);
      // Break the path across gaps. A straight segment over missing months
      // asserts data that was never collected.
      d += (prev === null || idx !== prev + 1 ? 'M' : 'L') + `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)} `;
      prev = idx;
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'series-line');
    path.setAttribute('d', d.trim());
    path.setAttribute('stroke', color);
    path.dataset.series = String(i);
    g.appendChild(path);
  });

  const crosshair = document.createElementNS(NS, 'line');
  crosshair.setAttribute('class', 'crosshair');
  crosshair.setAttribute('y1', 0); crosshair.setAttribute('y2', ih);
  crosshair.style.opacity = '0';
  g.appendChild(crosshair);

  const dots = live.map(() => {
    const c = document.createElementNS(NS, 'circle');
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

  const dateAt = (event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W - M.left;
    const idx = Math.round((px / iw) * (dates.length - 1));
    return idx >= 0 && idx < dates.length ? { iso: dates[idx], box } : null;
  };

  svg.addEventListener('pointermove', (event) => {
    const hit = dateAt(event);
    if (!hit) return;
    const cx = x(hit.iso);
    crosshair.setAttribute('x1', cx); crosshair.setAttribute('x2', cx);
    crosshair.style.opacity = '1';

    let html = `<div class="tooltip-date">${fmtDate(hit.iso, cadence)}</div>`;
    live.forEach((s, i) => {
      const p = s.points.find((q) => q.date === hit.iso && q.value != null);
      if (p) {
        dots[i].setAttribute('cx', cx); dots[i].setAttribute('cy', y(p.value));
        dots[i].setAttribute('fill', `var(${SERIES_COLORS[i % SERIES_COLORS.length]})`);
        dots[i].style.opacity = '1';
        html += `<div class="tooltip-row">
          <span class="legend-swatch" style="background:var(${SERIES_COLORS[i % SERIES_COLORS.length]})"></span>
          <span>${escapeHtml(s.label)}</span>
          <span class="tooltip-val">${fmt(p.value)}${unit ? ' ' + escapeHtml(unit) : ''}</span></div>`;
      } else dots[i].style.opacity = '0';
    });
    if (onPick) html += '<div class="tooltip-hint">Click to see what happened</div>';

    tip.innerHTML = html;
    tip.classList.add('on');
    tip.style.left = `${Math.min(Math.max((cx + M.left) / W * hit.box.width - 70, 4), hit.box.width - 160)}px`;
  });

  svg.addEventListener('pointerleave', () => {
    crosshair.style.opacity = '0';
    dots.forEach((d) => { d.style.opacity = '0'; });
    tip.classList.remove('on');
  });

  if (onPick) {
    svg.addEventListener('click', (event) => {
      const hit = dateAt(event);
      if (hit) onPick(hit.iso, cadence);
    });
  }

  // A legend whenever more than one series is drawn, so identity never rests on
  // colour alone. One series is named by the card title instead.
  if (live.length > 1) {
    const legend = el('div', 'legend');
    live.forEach((s, i) => {
      const item = el('button', 'legend-item');
      item.type = 'button';
      item.setAttribute('aria-pressed', 'true');
      item.innerHTML = `<span class="legend-swatch" style="background:var(${SERIES_COLORS[i % SERIES_COLORS.length]})"></span>${escapeHtml(s.label)}`;
      item.addEventListener('click', () => {
        const on = item.getAttribute('aria-pressed') === 'true';
        item.setAttribute('aria-pressed', String(!on));
        const p = g.querySelector(`path[data-series="${i}"]`);
        if (p) p.style.display = on ? 'none' : '';
      });
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }
}

/* ── data ──────────────────────────────────────────────────────────────────*/

async function loadSeries(ids, countries, { index = false } = {}) {
  const qs = new URLSearchParams({ ids: ids.join(','), countries: countries.map((c) => c ?? '').join(',') });
  if (index) qs.set('index', 'true');
  return api(`/api/series?${qs}`);
}

/* ── context drawer ────────────────────────────────────────────────────────*/

/** Widen a clicked point into the period it represents. */
function windowFor(iso, cadence) {
  const d = new Date(iso + 'T00:00:00Z');
  const end = new Date(d);
  if (cadence === 'annual') end.setUTCFullYear(d.getUTCFullYear() + 1);
  else if (cadence === 'quarterly') end.setUTCMonth(d.getUTCMonth() + 3);
  else end.setUTCMonth(d.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: iso, to: end.toISOString().slice(0, 10) };
}

async function openContext(iso, cadence) {
  const { from, to } = windowFor(iso, cadence);
  const drawer = $('#drawer'), scrim = $('#scrim'), body = $('#drawer-body');

  /**
   * Title the window by its real dates, not by the period name.
   *
   * A sparse series infers a wider cadence than its nominal one — the
   * regulatory counts have monthly points with multi-month gaps, so they read
   * as quarterly — and the window then runs three months from the clicked
   * point. Labelling that "2026 Q2" while listing articles from late July is a
   * small lie. Stating the range says exactly what was searched.
   */
  const dateRange = (a, b) => {
    const opts = { day: 'numeric', month: 'short' };
    const start = new Date(a + 'T00:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
    const end = new Date(b + 'T00:00:00Z').toLocaleDateString(undefined, { ...opts, year: 'numeric', timeZone: 'UTC' });
    return `${start} – ${end}`;
  };

  $('#drawer-title').textContent = fmtDate(iso, cadence);
  $('#drawer-sub').textContent = `Reported ${dateRange(from, to)}`;
  body.innerHTML = '<div class="loading">Loading…</div>';
  drawer.hidden = false; scrim.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('open'));
  $('#drawer-close').focus();

  try {
    const data = await api(`/api/context?from=${from}&to=${to}&limit=25`);
    body.innerHTML = '';

    if (data.events.length) {
      body.appendChild(el('div', 'drawer-section', 'Deals announced'));
      data.events.forEach((e) => {
        const row = el('div', 'ctx-item');
        row.innerHTML = `<div class="ctx-title">${escapeHtml(e.headline)}</div>
          <div class="ctx-meta">${escapeHtml(e.from_name)}${e.to_name ? ' → ' + escapeHtml(e.to_name) : ''}
          ${e.amount_usd ? ' · $' + fmt(Number(e.amount_usd)) : ''}
          <span class="score">${e.source_count} sources</span></div>`;
        body.appendChild(row);
      });
    }

    if (data.documents.length) {
      body.appendChild(el('div', 'drawer-section', `Coverage (${data.documents.length})`));
      data.documents.forEach((d) => {
        const a = el('a', 'ctx-item');
        a.href = d.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.innerHTML = `<div class="ctx-title">${escapeHtml(d.title)}</div>
          <div class="ctx-meta"><span class="score ${d.ai_relevance >= 70 ? 'hi' : ''}">${d.ai_relevance}</span>
          ${escapeHtml(d.source_name)} · ${new Date(d.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>`;
        body.appendChild(a);
      });
    }

    if (!data.events.length && !data.documents.length) {
      body.appendChild(el('div', 'empty',
        'Nothing recorded for this period. News collection began recently, so earlier periods are sparse.'));
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', 'err', e.message));
  }
}

function closeContext() {
  const drawer = $('#drawer');
  drawer.classList.remove('open');
  $('#scrim').hidden = true;
  setTimeout(() => { drawer.hidden = true; }, 200);
}

/* ── views ─────────────────────────────────────────────────────────────────*/

const text = (row, field) =>
  state.mode === 'expert' ? (row[`${field}_expert`] || row[`${field}_plain`]) : (row[`${field}_plain`] || row[`${field}_expert`]);

function chartCard(title, caption, { tall = false } = {}) {
  const c = el('article', `card${tall ? ' card-hero' : ''}`);
  const head = el('div', 'card-head');
  const wrap = el('div');
  wrap.appendChild(el('h3', 'card-title', title));
  head.appendChild(wrap);
  c.appendChild(head);
  const body = el('div', 'card-body');
  c.appendChild(body);
  if (caption) {
    const cap = el('p', 'card-caption');
    cap.textContent = caption;
    c.appendChild(cap);
  }
  return { card: c, body };
}

/** Group indicators that share a chart_group onto one chart. */
function groupIndicators(list) {
  const out = [];
  const groups = new Map();
  for (const ind of list) {
    if (!ind.chart_group) { out.push({ members: [ind] }); continue; }
    if (!groups.has(ind.chart_group)) {
      const entry = { members: [], group: ind.chart_group };
      groups.set(ind.chart_group, entry);
      out.push(entry);
    }
    groups.get(ind.chart_group).members.push(ind);
  }
  return out;
}

async function drawGroup(container, members, { tall = false } = {}) {
  const lead = members[0];
  const title = members.length > 1 && lead.chart_group
    ? members.map((m) => m.name.replace(/^(US|UK|EU27?|China|Japan|Australia)\s+/i, '')).slice(0, 2).join(' vs ')
    : lead.name;

  const { card, body } = chartCard(title, text(lead, 'caption'), { tall });
  container.appendChild(card);

  try {
    const data = await loadSeries(
      members.map((m) => m.indicator_id),
      members.map((m) => m.country_iso3 || m.default_country_iso3 || null)
    );
    const series = data.series.map((s, i) => ({
      label: members[i].name,
      points: s.points,
    }));
    const cadence = inferCadence(series[0].points);
    lineChart(body, series, {
      cadence,
      unit: lead.unit_symbol || '',
      height: tall ? 300 : 250,
      // A narrower viewBox for the two-up charts. The SVG is scaled to fit its
      // column, so a box wider than the column shrinks the type with it.
      width: tall ? 760 : 460,
      onPick: openContext,
    });

    // Source line. Researchers asked for provenance; generalists ignore it.
    const meta = el('div', 'card-meta');
    const conf = lead.confidence_tier;
    meta.innerHTML = `<span class="pill tier-${conf}">${conf}</span>
      <span>${escapeHtml(lead.source_name || lead.source_id)}</span>
      ${lead.source_url ? `<a href="${escapeHtml(lead.source_url)}" target="_blank" rel="noopener noreferrer">source</a>` : ''}
      <span class="card-meta-right">${lead.observation_count.toLocaleString()} points · ${lead.first_period?.slice(0, 4)}–${lead.last_period?.slice(0, 4)}</span>`;
    card.appendChild(meta);
  } catch (e) {
    body.appendChild(el('div', 'err', 'Could not load: ' + e.message));
  }
}

async function viewQuestion(root, slug) {
  root.innerHTML = '<div class="loading">Loading…</div>';
  const q = await api(`/api/questions/${slug}`);
  root.innerHTML = '';

  // The answer. This is the sentence the old dashboard was missing.
  const answer = el('section', 'answer');
  answer.innerHTML = `<p class="answer-text">${escapeHtml(text(q, 'answer'))}</p>`;
  root.appendChild(answer);

  const heroes = q.indicators.filter((i) => i.role === 'hero');
  const supporting = q.indicators.filter((i) => i.role === 'supporting');
  const context = q.indicators.filter((i) => i.role === 'context');

  // Cards are appended in order first, then filled concurrently. Awaiting each
  // chart in turn meant an eighteen-chart page fetched eighteen series one at a
  // time, and the reader watched them appear over several seconds.
  const pending = heroes.map((h) => drawGroup(root, [h], { tall: true }));

  let supportingGrid = null;
  if (supporting.length) {
    root.appendChild(el('h2', 'section-title', 'The evidence'));
    supportingGrid = el('div', 'grid two');
    root.appendChild(supportingGrid);
    for (const g of groupIndicators(supporting)) pending.push(drawGroup(supportingGrid, g.members));
  }

  // The caveat is given its own block, not a footnote. The limits of this data
  // are large, and stating them is what separates this from a sales pitch.
  if (q.caveat) {
    const caveat = el('section', 'caveat');
    caveat.innerHTML = `<h2 class="caveat-title">What this doesn't tell you</h2>
      <p>${escapeHtml(q.caveat)}</p>`;
    root.appendChild(caveat);
  }

  if (context.length) {
    root.appendChild(el('h2', 'section-title', 'Background'));
    const grid = el('div', 'grid two');
    root.appendChild(grid);
    for (const g of groupIndicators(context)) pending.push(drawGroup(grid, g.members));
  }

  await Promise.all(pending);
}

async function viewExplore(root) {
  root.innerHTML = '';
  const intro = el('section', 'answer');
  intro.innerHTML = `<p class="answer-text">Put any indicators on one chart. Where they are measured
    on different scales they are indexed to 100 at the first period they share, so you compare
    shape rather than size — this dashboard never draws a second y-axis, because two scales let
    any pair of lines be made to cross wherever the author likes.</p>`;
  root.appendChild(intro);

  const { card, body } = chartCard('Your chart', null, { tall: true });
  const picker = el('div', 'picker');
  const search = el('input', 'input picker-search');
  search.type = 'search';
  search.placeholder = `Search ${state.indicators.length} indicators…`;
  search.setAttribute('aria-label', 'Search indicators');

  const list = el('div', 'picker-list');
  const chosen = [];
  const chips = el('div', 'chips');

  const redraw = async () => {
    chips.innerHTML = '';
    chosen.forEach((ind, i) => {
      const chip = el('span', 'chip');
      chip.innerHTML = `<span class="legend-swatch" style="background:var(${SERIES_COLORS[i % SERIES_COLORS.length]})"></span>${escapeHtml(ind.name)}`;
      const x = el('button', 'chip-x', '×');
      x.setAttribute('aria-label', `Remove ${ind.name}`);
      x.addEventListener('click', () => { chosen.splice(i, 1); redraw(); });
      chip.appendChild(x);
      chips.appendChild(chip);
    });

    if (!chosen.length) {
      body.innerHTML = '';
      body.appendChild(el('div', 'empty', 'Choose an indicator to begin.'));
      return;
    }

    body.innerHTML = '<div class="loading">Loading…</div>';
    // Index whenever the chosen series do not all share a unit.
    const units = new Set(chosen.map((c) => c.unit));
    const needIndex = units.size > 1;
    const data = await loadSeries(
      chosen.map((c) => c.id),
      chosen.map((c) => c.default_country_iso3 || null),
      { index: needIndex }
    );
    lineChart(body, data.series.map((s, i) => ({ label: chosen[i].name, points: s.points })), {
      cadence: inferCadence(data.series[0].points),
      unit: needIndex ? '' : (chosen[0].unit_symbol || ''),
      height: 320,
      onPick: openContext,
    });
    const note = el('div', 'card-meta');
    note.innerHTML = data.indexed
      ? `<span class="pill warn">indexed</span><span>Different units — all series set to 100 at ${data.indexBase}, so this compares shape, not level.</span>`
      : `<span class="pill ok">same unit</span><span>All series share a unit, so values are shown as published.</span>`;
    body.appendChild(note);
  };

  const renderList = (q = '') => {
    const term = q.toLowerCase();
    const matches = state.indicators
      .filter((i) => i.observation_count > 0)
      .filter((i) => !term || i.name.toLowerCase().includes(term) || i.id.toLowerCase().includes(term))
      .slice(0, 60);
    list.innerHTML = '';
    if (!matches.length) { list.appendChild(el('div', 'empty', 'Nothing matches.')); return; }
    matches.forEach((ind) => {
      const b = el('button', 'picker-item');
      b.innerHTML = `<span>${escapeHtml(ind.name)}</span>
        <span class="picker-meta">${escapeHtml(ind.unit || '')} · ${ind.observation_count.toLocaleString()}</span>`;
      b.addEventListener('click', () => {
        if (chosen.length >= 6) return;
        if (!chosen.some((c) => c.id === ind.id)) { chosen.push(ind); redraw(); }
      });
      list.appendChild(b);
    });
  };

  search.addEventListener('input', () => renderList(search.value));
  picker.appendChild(search);
  picker.appendChild(chips);
  picker.appendChild(list);

  const layout = el('div', 'grid explore');
  layout.appendChild(card);
  layout.appendChild(picker);
  root.appendChild(layout);

  renderList();
  redraw();
}

async function viewNews(root) {
  root.innerHTML = '';
  const intro = el('section', 'answer');
  intro.innerHTML = `<p class="answer-text">Coverage scored for relevance to AI economics at
    ingestion, by keyword matching — no model is involved, so the score is the same every time.
    Sport, crime and celebrity are excluded outright rather than scored down.</p>`;
  root.appendChild(intro);

  const { card, body } = chartCard('Recent coverage', null);
  body.classList.add('flush');
  root.appendChild(card);
  try {
    const { documents } = await api('/api/documents?limit=100');
    if (!documents.length) { body.appendChild(el('div', 'empty', 'No articles yet.')); return; }
    documents.forEach((d) => {
      const a = el('a', 'news-item');
      a.href = d.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `<div class="news-meta">
          <span class="score ${d.ai_relevance >= 70 ? 'hi' : ''}">${d.ai_relevance}</span>
          <span class="news-src">${escapeHtml(d.source_name)}</span>
          <span class="news-src">· ${new Date(d.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        </div><div class="news-title">${escapeHtml(d.title)}</div>`;
      body.appendChild(a);
    });
  } catch (e) { body.appendChild(el('div', 'err', e.message)); }
}

async function viewPipeline(root) {
  root.innerHTML = '';
  const s = state.status;

  const intro = el('section', 'answer');
  intro.innerHTML = `<p class="answer-text">Every figure here comes from a named statistical agency
    and is refetched on a schedule. This page shows what ran, what failed and what is going stale —
    published rather than hidden, because silent staleness is how a dashboard like this rots.</p>`;
  root.appendChild(intro);

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

  const intg = chartCard('Data sources', null);
  intg.body.classList.add('flush');
  const it = el('table', 'table');
  it.innerHTML = '<thead><tr><th scope="col">Source</th><th scope="col">State</th><th scope="col">Note</th></tr></thead>';
  const ib = el('tbody');
  s.integrations.forEach((i) => {
    const tr = el('tr');
    tr.innerHTML = `<td>${escapeHtml(i.name)}</td>
      <td><span class="pill ${i.ready ? 'ok' : 'warn'}">${i.ready ? 'ready' : 'not configured'}</span></td>
      <td class="muted-cell">${escapeHtml(i.note)}</td>`;
    ib.appendChild(tr);
  });
  it.appendChild(ib);
  const iscroll = el('div', 'table-scroll'); iscroll.appendChild(it);
  intg.body.appendChild(iscroll);
  grid.appendChild(intg.card);

  const runs = chartCard('Recent ingestion runs', null);
  runs.body.classList.add('flush');
  const rt = el('table', 'table');
  rt.innerHTML = '<thead><tr><th scope="col">Job</th><th scope="col">Result</th><th scope="col" class="num">Rows</th></tr></thead>';
  const rb = el('tbody');
  s.recentRuns.forEach((r) => {
    const tr = el('tr');
    const cls = r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'off' : 'warn';
    tr.innerHTML = `<td class="muted-cell">${escapeHtml(r.job_name)}</td>
      <td><span class="pill ${cls}">${r.status}</span></td>
      <td class="num">${r.rows_written ?? 0}</td>`;
    rb.appendChild(tr);
  });
  rt.appendChild(rb);
  const rscroll = el('div', 'table-scroll'); rscroll.appendChild(rt);
  runs.body.appendChild(rscroll);
  grid.appendChild(runs.card);
}

/* ── routing ───────────────────────────────────────────────────────────────*/

async function render() {
  const root = $('#view');
  root.innerHTML = '<div class="loading">Loading…</div>';

  document.querySelectorAll('.nav-item').forEach((b) => b.removeAttribute('aria-current'));
  const active = state.view === 'question'
    ? document.querySelector(`.nav-item[data-slug="${state.slug}"]`)
    : document.querySelector(`.nav-item[data-view="${state.view}"]`);
  if (active) active.setAttribute('aria-current', 'page');

  try {
    if (state.view === 'question') {
      const q = state.questions.find((x) => x.slug === state.slug);
      $('#page-title').textContent = q ? q.question : 'EconIntel';
      $('#page-sub').textContent = q ? q.subtitle : '';
      await viewQuestion(root, state.slug);
    } else if (state.view === 'explore') {
      $('#page-title').textContent = 'Build a chart';
      $('#page-sub').textContent = `Compare any of ${state.indicators.length} indicators`;
      await viewExplore(root);
    } else if (state.view === 'news') {
      $('#page-title').textContent = 'News';
      $('#page-sub').textContent = 'Relevance-filtered AI economics coverage';
      await viewNews(root);
    } else if (state.view === 'pipeline') {
      $('#page-title').textContent = 'Where this comes from';
      $('#page-sub').textContent = 'Sources, freshness and failures';
      await viewPipeline(root);
    }
  } catch (e) {
    root.innerHTML = '';
    root.appendChild(el('div', 'err', 'Failed to render: ' + e.message));
  }
}

/** Hash routing, so a page can be linked to and the back button works. */
function applyHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) { state.view = 'question'; state.slug = state.questions[0]?.slug ?? 'adoption'; return; }
  if (['explore', 'news', 'pipeline'].includes(hash)) { state.view = hash; return; }
  state.view = 'question';
  state.slug = hash;
}

function go(view, slug) {
  location.hash = view === 'question' ? `#/${slug}` : `#/${view}`;
}

function buildNav() {
  const box = $('#nav-questions');
  box.innerHTML = '';
  state.questions.forEach((q) => {
    const b = el('button', 'nav-item');
    b.dataset.view = 'question';
    b.dataset.slug = q.slug;
    b.innerHTML = `<span class="nav-dot" aria-hidden="true"></span>
      <span class="nav-text">${escapeHtml(q.question)}</span>
      <span class="nav-count">${q.indicator_count}</span>`;
    b.addEventListener('click', () => go('question', q.slug));
    box.appendChild(b);
  });
  document.querySelectorAll('.nav-item[data-view]:not([data-slug])').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.view));
  });
}

function wireChrome() {
  $('#refresh-btn').addEventListener('click', () => { state.cache.clear(); boot(); });
  $('#drawer-close').addEventListener('click', closeContext);
  $('#scrim').addEventListener('click', closeContext);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContext(); });
  addEventListener('hashchange', () => { applyHash(); render(); });

  const applyMode = (mode) => {
    state.mode = mode;
    document.documentElement.setAttribute('data-mode', mode);
    document.querySelectorAll('.mode-btn').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    try { localStorage.setItem('econintel-mode', mode); } catch { /* private mode */ }
  };
  document.querySelectorAll('.mode-btn').forEach((b) =>
    b.addEventListener('click', () => { applyMode(b.dataset.mode); render(); }));
  let storedMode = null;
  try { storedMode = localStorage.getItem('econintel-mode'); } catch { /* ignore */ }
  applyMode(storedMode === 'expert' ? 'expert' : 'plain');

  const applyTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    $('#theme-label').textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    try { localStorage.setItem('econintel-theme', mode); } catch { /* ignore */ }
  };
  let storedTheme = null;
  try { storedTheme = localStorage.getItem('econintel-theme'); } catch { /* ignore */ }
  applyTheme(storedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#theme-toggle').addEventListener('click', () =>
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  const bar = $('#topbar');
  addEventListener('scroll', () => bar.classList.toggle('stuck', scrollY > 4), { passive: true });
}

async function boot() {
  try {
    const [questions, indicators, status] = await Promise.all([
      api('/api/questions'), api('/api/indicators?hasData=true'), api('/api/status'),
    ]);
    state.questions = questions.questions;
    state.indicators = indicators.indicators;
    state.status = status;

    buildNav();
    const news = document.querySelector('[data-count="news"]');
    if (news) news.textContent = status.counts.documents;

    applyHash();
    await render();
  } catch (e) {
    $('#view').innerHTML = '';
    $('#view').appendChild(el('div', 'err',
      `Cannot reach the API (${e.message}). Is the server running on port 3000?`));
  }
}

wireChrome();
boot();
