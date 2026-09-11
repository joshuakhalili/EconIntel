/** Source metadata, not a statistical test: absent flags do not prove comparability. */
export function hasSeriesBreak(point) {
  return /(?:OBSV_STATUS|OBS_STATUS)=B(?:\s|;|$)/i.test(point?.value_status ?? '') ||
    /OBS_FLAG=b[a-z]*(?:\s|;|$)/i.test(point?.value_status ?? '') ||
    /break in (?:time )?series/i.test(point?.value_status ?? '');
}

export function crossesSeriesBreak(points, from, to) {
  return points.some(p => p.date > from && p.date <= to && hasSeriesBreak(p));
}

export function isProjected(point) {
  return /^projected(?:\s*;|$)/i.test(point?.value_status ?? '');
}
