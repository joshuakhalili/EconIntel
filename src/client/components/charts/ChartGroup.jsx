import { useSeries } from '@/hooks/queries';
import { displayUnit } from '@/lib/format';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import ChartCard from './ChartCard';
import SeriesChart from './SeriesChart';

/**
 * One chart, drawn from the indicators the editorial layer put in a group.
 *
 * `chart_group` is the statement that these indicators belong on the same pair
 * of axes. Indicators with no group each get their own chart — that absence is
 * also a decision, not missing data.
 *
 * The caption is stored text explaining why this chart is under this question.
 * It is never generated here; the front end arranges evidence, it does not
 * author claims.
 */
export default function ChartGroup({ members, height = 260, onPick }) {

  const ids = members.map((m) => m.indicator_id);
  // Positional: the endpoint pairs the nth country with the nth id. These are
  // already resolved per indicator by the editorial layer.
  const countries = members.map((m) => m.country_iso3 ?? '');

  // Different units cannot share one axis, and a second axis is not an option,
  // so the server rebases them to a common base instead.
  //
  // Compared on the DISPLAY form, not the raw provider string. Several
  // indicators share a real unit while carrying different notes after it —
  // "index, 2015 = 100 (2015-01 = 99.9…)" against
  // "index, 2015 = 100 (2015-01 = 100.8…)" — and comparing raw strings reads
  // those as a mismatch, rebasing a chart that was already on one scale.
  const units = new Set(members.map((m) => displayUnit(m.unit)).filter(Boolean));
  const mustIndex = units.size > 1;

  const { data: payload, isPending, isError, error } = useSeries(ids, {
    countries,
    index: mustIndex,
  });

  const lead = members[0];
  const title = members.length === 1 ? lead.name : groupTitle(members);
  const caption = lead.caption_plain;

  const sources = [...new Set(members.map((m) => m.source_name ?? m.source_id).filter(Boolean))];

  // The footer states what the response actually did, not what was requested
  // — `mustIndex` only asked for a rebase; whether every series got one (or
  // any did, if there was no shared period) is `payload`'s to say once it
  // arrives, and claiming it before then would be a guess dressed as a fact.
  const rawSeries = payload?.series?.filter((s) => s.indexed === false) ?? [];
  const indexedSeries = payload?.series?.filter((s) => s.indexed === true) ?? [];

  return (
    <ChartCard
      title={title}
      caption={caption}
      footer={
        <span className="flex flex-wrap items-center gap-x-2">
          <span>{sources.join(', ')}</span>
          {payload?.indexed && rawSeries.length === 0 && (
            <span>· rebased to 100 at the first shared period</span>
          )}
          {payload?.indexed && rawSeries.length > 0 && (
            <span className="text-warn">
              · {indexedSeries.length} of {indexedSeries.length + rawSeries.length} series rebased
              to 100 — the rest (dashed) stayed in raw units, value was 0 at the shared base period
            </span>
          )}
          {payload?.indexNote && <span className="text-warn">· {payload.indexNote}</span>}
        </span>
      }
    >
      {isPending && <LoadingBlock rows={1} />}
      {isError && <ErrorBlock error={error} what={title} />}
      {payload && <SeriesChart payload={payload} height={height} onPick={onPick} />}
    </ChartCard>
  );
}

/**
 * Name a multi-indicator chart by what its members have in common, falling
 * back to the first indicator's name rather than concatenating all of them
 * into something unreadable.
 */
function groupTitle(members) {
  const names = members.map((m) => m.name);
  const shared = commonPrefix(names).replace(/[\s,\-–—:]+$/, '');
  return shared.length > 12 ? shared : names[0];
}

function commonPrefix(strings) {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (const s of strings.slice(1)) {
    while (!s.startsWith(prefix) && prefix) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
