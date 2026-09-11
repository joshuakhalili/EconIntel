import { createHash } from 'node:crypto';
import { hasSeriesBreak, isProjected } from '../../shared/observationQuality.js';

export const FACT_NARRATION_VERSION = 'typed-facts-v2-2026-09-10';

// A fact ID binds the complete tuple, not just a numeric token. A selector can
// choose facts but cannot supply prose, country names, dates, units or values.
export function narrationFacts(grounding) {
  return (grounding?.series ?? []).flatMap((row) => {
    if (!Number.isFinite(row.latest) || typeof row.name !== 'string' || !row.name.trim()) return [];
    const fact = {
      indicator: row.indicator_id ?? row.name,
      name: row.name,
      country: row.country ?? grounding.country ?? 'Geography not specified',
      unit: row.unit || 'unit not recorded',
      period: row.period || (grounding.scenario ? 'scenario assumption' : 'period not recorded'),
      period_end: row.period_end ?? null,
      previous_period: row.previous_period ?? null,
      latest: row.latest,
      previous: Number.isFinite(row.previous) ? row.previous : null,
      value_status: row.value_status ?? null,
      previous_status: row.previous_status ?? null,
      comparison_blocked: row.comparison_blocked === true,
      source_url: row.source_url ?? null,
      basis: grounding.scenario ? 'scenario' : 'reported',
      scenario: grounding.scenario ?? null,
    };
    const id = `fact-${createHash('sha256').update(JSON.stringify(fact)).digest('hex')}`;
    return [{ id, ...fact }];
  });
}

export function validateFactSelection(selection, facts) {
  if (!selection || Array.isArray(selection) || typeof selection !== 'object' ||
      Object.keys(selection).some(key => key !== 'factIds') ||
      !Array.isArray(selection.factIds) || selection.factIds.length < 1 || selection.factIds.length > 2) {
    return { ok: false, reason: 'Only one or two factIds may be selected' };
  }
  const ids = new Set(facts.map(f => f.id));
  if (ids.size !== facts.length || new Set(selection.factIds).size !== selection.factIds.length ||
      selection.factIds.some(id => typeof id !== 'string' || !ids.has(id))) {
    return { ok: false, reason: 'Unknown, duplicate or stale fact ID' };
  }
  return { ok: true };
}

function statusText(fact) {
  if (fact.basis === 'scenario') return 'model scenario, not an observed outcome';
  if (/status_unverified/.test(fact.value_status ?? '')) return 'previously projected; outturn unverified';
  if (isProjected({ value_status: fact.value_status })) return 'projection, not a measurement';
  // Preserve provider qualifications; absence of a flag is not proof of finality.
  return fact.value_status ? `reported value; provider status: ${fact.value_status}` : 'reported value';
}

export function renderFactSelection(selection, facts) {
  const verdict = validateFactSelection(selection, facts);
  if (!verdict.ok) throw new Error(verdict.reason);
  return selection.factIds.map(id => {
    const fact = facts.find(f => f.id === id);
    const start = `${fact.name} — ${fact.country}: ${fact.latest} ${fact.unit} (${fact.period}; ${statusText(fact)})`;
    const broken = hasSeriesBreak({ value_status: fact.value_status }) ||
      hasSeriesBreak({ value_status: fact.previous_status });
    if (fact.comparison_blocked || broken) return `${start}; comparison withheld because periods, sources or populations may not be comparable.`;
    if (fact.previous === null || !fact.previous_period) return `${start}.`;
    const direction = fact.latest > fact.previous ? 'higher than' : fact.latest < fact.previous ? 'lower than' : 'unchanged from';
    const priorStatus = statusText({ ...fact, value_status: fact.previous_status });
    return `${start}; ${direction} ${fact.previous} ${fact.unit} (${fact.previous_period}; ${priorStatus}).`;
  }).join(' ');
}

export function typedNarration(grounding, selection) {
  const facts = narrationFacts(grounding);
  if (!facts.length) return null;
  // Existing editorial ticker order, not AI ranking of economic importance.
  const defaults = grounding.scenario && facts.length > 2 ? [facts[0], facts[2]] : facts.slice(0, 2);
  const selected = selection ?? { factIds: defaults.map(f => f.id) };
  return { body: renderFactSelection(selected, facts),
    grounding: { ...grounding, facts, selection: selected, renderer_version: FACT_NARRATION_VERSION } };
}

/** Read boundary: cached prose must still equal the current deterministic
 * rendering. This rejects stale facts and tampered text even with a valid key.
 */
export function verifiedNarration(row, currentGrounding) {
  if (!row) return null;
  try {
    const current = typedNarration(currentGrounding, row.grounding?.selection);
    if (!current || row.grounding?.renderer_version !== FACT_NARRATION_VERSION || current.body !== row.body) return null;
    return { ...row, grounding: current.grounding };
  } catch { return null; }
}
