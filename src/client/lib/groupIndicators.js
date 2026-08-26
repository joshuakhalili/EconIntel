/**
 * Split a question's indicators into charts, by role.
 *
 * Two rules, both editorial rather than presentational:
 *
 *   - Indicators sharing a `chart_group` belong on one pair of axes. A group
 *     can span roles (a hero and a supporting indicator often sit on the same
 *     chart), so grouping happens first and the group takes the strongest role
 *     any of its members has.
 *   - An indicator with no `chart_group` gets its own chart. That absence is a
 *     decision too — it means nothing else was meant to share its axis.
 */

const ROLE_RANK = { hero: 0, supporting: 1, context: 2 };

export function groupIndicators(indicators = []) {
  const groups = [];
  const byName = new Map();

  for (const indicator of indicators) {
    if (!indicator.chart_group) {
      groups.push({ key: indicator.indicator_id, role: indicator.role, members: [indicator] });
      continue;
    }
    const existing = byName.get(indicator.chart_group);
    if (existing) {
      existing.members.push(indicator);
      if (ROLE_RANK[indicator.role] < ROLE_RANK[existing.role]) existing.role = indicator.role;
    } else {
      const group = {
        key: indicator.chart_group,
        role: indicator.role,
        members: [indicator],
      };
      byName.set(indicator.chart_group, group);
      groups.push(group);
    }
  }

  const inRole = (role) =>
    groups
      .filter((g) => g.role === role)
      .sort((a, b) => (a.members[0].sort_order ?? 0) - (b.members[0].sort_order ?? 0));

  return { hero: inRole('hero'), supporting: inRole('supporting'), context: inRole('context') };
}
