export const PRIORITY_COUNTRIES = ['USA', 'GBR', 'DEU', 'FRA', 'JPN', 'CAN', 'CHN', 'IND', 'BRA'];
export const DEPTH_DOMAINS = {
  adoption: ['adoption'],
  'productivity/output': ['productivity', 'exposed-productivity', 'sector-output', 'total-factor-productivity'],
  labour: ['jobs', 'clerical', 'entry-level', 'vacancies', 'aggregate-unemployment'],
  investment: ['money', 'building', 'dot-com', 'orders-and-output'],
  energy: ['power', 'bulk-discount'],
};

/** Deliberately narrow: adoption survey series measure AI use, not its effects.
 * All other series remain context/proxies until an editorial assessment says
 * otherwise. Neither classification claims causal identification.
 */
export function evidenceRole(row) {
  return (/^(?:eurostat|oecd)\.ai_any\./.test(row.indicator_id) || row.indicator_id === 'census_btos.ai_use_current.USA')
    ? 'direct_ai_adoption_measure' : 'economic_context_or_proxy';
}

export function priorityDepth(matrix) {
  return PRIORITY_COUNTRIES.flatMap((iso3) => Object.entries(DEPTH_DOMAINS).map(([domain, questions]) => {
    const placements = matrix.filter((row) => row.iso3 === iso3 && questions.includes(row.question_id));
    const populated = placements.filter((row) => row.observation_count > 0);
    const ids = [...new Set(populated.map((row) => row.indicator_id))];
    const direct = [...new Set(populated.filter((row) => evidenceRole(row) === 'direct_ai_adoption_measure').map((row) => row.indicator_id))];
    const directLatest = populated.filter((row) => evidenceRole(row) === 'direct_ai_adoption_measure').map((row) => row.last_period).filter(Boolean).sort().at(-1) ?? null;
    const uncoveredQuestions = questions.filter((question) => !populated.some((row) => row.question_id === question));
    return { iso3, domain, indicator_count: ids.length, direct_ai_measures: direct.length, direct_ai_latest: directLatest,
      uncovered_questions: uncoveredQuestions,
      latest_period: populated.map((row) => row.last_period).filter(Boolean).sort().at(-1) ?? null,
      gap: !ids.length ? 'No country-specific series for these questions'
        : domain === 'adoption' && !direct.length ? 'Only context/proxies; no direct AI-use survey'
        : uncoveredQuestions.length ? `No country-specific series for: ${uncoveredQuestions.join(', ')}`
        : 'Series available; relevance, comparability and causal interpretation require review',
    };
  }));
}
