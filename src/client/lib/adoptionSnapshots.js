// Display-order snapshots, never a cross-survey adoption ranking.
export function adoptionSnapshots(rows = [], today = new Date().toISOString().slice(0, 10)) {
  return rows.filter((row) => Number.isFinite(row.latest_value) && row.quantity_kind === 'rate')
    .map((row) => ({
      ...row,
      referencePeriodIncomplete: /^\d{4}-\d{2}-\d{2}$/.test(row.latest_period_end ?? '') && row.latest_period_end >= today,
      sourceFamily: row.indicator_id === 'derived.sec_ai_mention_rate'
        ? 'SEC filings — text mentions, not measured adoption'
        : row.indicator_id?.startsWith('dbn.OECD.') || row.indicator_id?.startsWith('oecd.')
          ? 'OECD enterprise-survey series — check country-specific scope'
          : row.indicator_id?.startsWith('eurostat.')
            ? 'Eurostat enterprise survey — check population and reference year'
            : 'Source-specific rate — check the measurement definition',
    }));
}
