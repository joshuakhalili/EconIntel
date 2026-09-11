/** Operational SLA, not a provider publication guarantee. A monthly news
 * indicator is stale after 75 days without a completed non-null period.
 */
export function gdeltFreshness(periodEnd, now = new Date()) {
  const parsed = periodEnd ? Date.parse(periodEnd) : NaN;
  if (!Number.isFinite(parsed)) return { state: 'missing', stale: true, age_days: null, threshold_days: 75 };
  const age = Math.floor((+now - parsed) / 86400000);
  return { state: age < 0 ? 'invalid_future' : age > 75 ? 'stale' : 'current', stale: age < 0 || age > 75, age_days: age, threshold_days: 75 };
}
