import { Link } from 'react-router-dom';
import { fmt, displayUnit } from '@/lib/format';
import { useReveal, revealClass } from '@/hooks/useReveal';
import { adoptionSnapshots } from '@/lib/adoptionSnapshots';

/**
 * The instrument each lens gets instead of a shared template.
 *
 * Five lenses hold five different KINDS of data, and giving them one layout
 * flattens that. Investment is physical inputs — copper, lithium, electricity.
 * Growth is adoption rates. Labour is three questions where every one is
 * contested. Prices is two series moving in opposite directions. Policy is a
 * handful of discrete counts and is much thinner than the rest.
 *
 * So the middle of each lens page is built for its own subject, from the same
 * chrome and the same type. Everything below is driven by data the page has
 * already fetched — no extra requests, and nothing invented where a lens is
 * thin. A lens with no signature falls through to nothing rather than to a
 * placeholder.
 */
export default function LensSignature({ lens, tickers, accent }) {
  const rows = tickers ?? [];
  if (rows.length === 0) return null;

  switch (lens.id) {
    case 'prices':
      return <Divergence rows={rows} accent={accent} />;
    case 'investment':
      return <MaterialsBoard rows={rows} accent={accent} />;
    case 'growth':
      return <AdoptionSpread rows={rows} accent={accent} />;
    case 'labour':
      return <Contested lens={lens} rows={rows} accent={accent} />;
    case 'regulation':
      return <RuleBoard rows={rows} accent={accent} />;
    default:
      return null;
  }
}

function SnapshotDetails({ row }) {
  const today = new Date().toISOString().slice(0, 10);
  const incomplete = /^\d{4}-\d{2}-\d{2}$/.test(row.latest_period_end ?? '') && row.latest_period_end >= today;
  return <>
    <p className="mt-2 text-caption-1-regular text-text-tertiary">{displayUnit(row.unit)}</p>
    <p className="mt-2 text-caption-1-regular text-text-tertiary">
      Reference period: {row.latest_period ?? 'not supplied'}
      {row.latest_period_end && row.latest_period_end !== row.latest_period ? ` to ${row.latest_period_end}` : ''}
      {row.latest_status ? ` · Source status: ${row.latest_status}` : ''}
      {incomplete ? ' · Reference period not complete; partial-period value' : ''}
    </p>
  </>;
}

function Band({ children, accent, eyebrow, title, note }) {
  const [ref, revealed] = useReveal();

  return (
    <section
      ref={ref}
      className={`relative mt-14 overflow-hidden rounded-3xl border border-border-button-default ${revealClass(revealed)}`}
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{ background: `radial-gradient(90% 70% at 12% 0%, ${accent.glow}, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative p-6 sm:p-10">
        <p className="eyebrow" style={{ color: accent.hex }}>
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-2xl text-title-1-medium leading-tight text-text-primary">
          {title}
        </h2>
        {note && <p className="prose-measure mt-2 text-body-regular text-text-tertiary">{note}</p>}
        {children}
      </div>
    </section>
  );
}

/* ── Prices & Markets ──────────────────────────────────────────────────────
   The finding on this lens is a divergence, and it is the single most
   surprising thing on the site: chips collapsed to under a third of their 1998
   price while the services built on them rose. Two figures opposed is a better
   statement of that than seven cards in a row. */
function Divergence({ rows, accent }) {
  /*
   * Selected by indicator id, not by matching the indicator's NAME.
   *
   * This used to be `/semiconductor/i` and `/data processing|hosting/i` over
   * `row.name`. A rename upstream — or the sort of label tidying
   * `017_unit_hygiene.sql` did — would return undefined, this module would
   * return null, and the Prices lens would silently lose its entire signature
   * band with no error anywhere. That is the same silent-blanking this project
   * keeps rediscovering, and an id cannot drift.
   */
  const byId = new Map(rows.map((r) => [r.indicator_id, r]));
  const chips = byId.get('fred.PCU334413334413');
  const hosting = byId.get('fred.PCU518210518210');
  if (!Number.isFinite(chips?.latest_value) || !Number.isFinite(hosting?.latest_value)) return null;

  return (
    <Band
      accent={accent}
      eyebrow="Different price baskets"
      title="Semiconductor and hosting producer-price indices."
      note="Published US price indices with different baskets and base periods. Their levels are not comparable, and neither measures the price of an equivalent AI task. These snapshots do not establish a current direction of change."
    >
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2">
        {[
          { row: chips, label: 'Semiconductors' },
          { row: hosting, label: 'Data processing and hosting' },
        ].map(({ row, label }) => {
          return (
            <div key={row.indicator_id} className="bg-panel p-6 sm:p-8">
              <p className="text-caption-1-medium text-text-secondary">{label}</p>
              <p
                className="figure mt-3 text-[clamp(2.75rem,7vw,4.5rem)] leading-none"
                style={{ color: accent.hex }}
              >
                {fmt(row.latest_value, row.decimals ?? 1)}
              </p>
              <SnapshotDetails row={row} />
              <p className="prose-measure mt-4 text-body-regular leading-relaxed text-text-secondary">
                {row.why}
              </p>
            </div>
          );
        })}
      </div>
    </Band>
  );
}

/* ── Investment & Capital ─────────────────────────────────────────────────
   This lens is priced physical inputs — the metals and power a data centre is
   built from. A board of them, largest movement first, is closer to what the
   subject is than a paragraph would be. */
function MaterialsBoard({ rows, accent }) {
  const board = rows
    .filter((r) => Number.isFinite(r.latest_value))
    .slice(0, 6);
  if (board.length === 0) return null;

  return (
    <Band
      accent={accent}
      eyebrow="Input-price context"
      title="Commodity and industrial electricity price snapshots."
      note="Latest stored observations, each with its own reference period and unit. These broad markets are not data-centre-specific procurement costs and do not identify AI demand or realised construction spending. An older endpoint is not a current quote."
    >
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {board.map((row) => (
          <div key={row.indicator_id} className="bg-panel p-5">
            <p className="text-caption-1-medium text-text-secondary">{row.label ?? row.name}</p>
            <p className="figure mt-2 text-title-1-medium text-text-primary">
              {fmt(row.latest_value, row.decimals ?? 1)}
              {row.unit_symbol ? (
                <span className="ml-1 text-body-regular text-text-tertiary">{row.unit_symbol}</span>
              ) : null}
            </p>
            <SnapshotDetails row={row} />
            <p className="mt-3 text-body-regular text-text-secondary">{row.why}</p>
          </div>
        ))}
      </div>
    </Band>
  );
}

/* Different estimands and survey populations must not become a ranking. */
function AdoptionSpread({ rows, accent }) {
  /*
   * Filtered on `quantity_kind`, not on a regex over the unit STRING.
   *
   * This used to test `/percent|%|enterprise|share/i` against `row.unit`. Unit
   * strings are editorial text that gets rewritten — `017_unit_hygiene.sql`
   * exists precisely because they were inconsistent — so a tidy-up could drop
   * every series out of this filter and blank the Growth lens's signature band
   * with nothing reporting it. `quantity_kind` is a typed column with a fixed
   * vocabulary and is the thing actually being asked about: is this a rate.
   */
  const board = adoptionSnapshots(rows);
  if (board.length === 0) return null;

  return (
    <Band
      accent={accent}
      eyebrow="Separate source snapshots"
      title="Mentioning AI and reporting its use are different measurements."
      note="These rates have different populations, definitions and reference periods. Neither their levels nor their ordering establish a country adoption ranking. None identifies an effect on output."
    >
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
        {board.map((row) => (
          <div key={row.indicator_id} className="bg-panel p-5">
            <p className="text-caption-1-regular text-text-secondary">
              {row.label ?? row.name}
            </p>
            <p className="mt-2 text-caption-1-regular text-text-tertiary">{row.sourceFamily}</p>
            <p className="figure mt-3 text-title-1-medium text-text-primary">
              {fmt(row.latest_value, row.decimals ?? 1)}{row.unit_symbol ?? ''}
            </p>
            <p className="mt-2 text-caption-1-regular text-text-tertiary">{displayUnit(row.unit)}</p>
            <p className="mt-2 text-caption-1-regular text-text-tertiary">
              Reference period: {row.latest_period ?? 'not supplied'}
              {row.latest_period_end && row.latest_period_end !== row.latest_period ? ` to ${row.latest_period_end}` : ''}
              {row.latest_status ? ` · Source status: ${row.latest_status}` : ''}
              {row.referencePeriodIncomplete ? ' · Reference period not complete; partial-period value' : ''}
            </p>
            <Link className="mt-3 inline-block text-caption-1-medium underline" to={`/data/${encodeURIComponent(row.indicator_id)}`}>
              Read the definition and source
            </Link>
          </div>
        ))}
      </div>
    </Band>
  );
}

/* ── Labour Markets ───────────────────────────────────────────────────────
   The only lens where every question is contested. That is the page: not what
   the data shows, but that credible sources reach opposite conclusions from
   it. Leading with the disagreement is more honest than leading with a number. */
function Contested({ lens, accent }) {
  const questions = lens.questions ?? [];
  const contested = questions.filter((q) => q.strength === 'contested');
  if (contested.length === 0) return null;

  const all = contested.length === questions.length;

  return (
    <Band
      accent={accent}
      eyebrow="Where this lens stands"
      title={
        all
          ? `All ${questions.length} questions here are contested.`
          : `${contested.length} of ${questions.length} questions here are contested.`
      }
      note="Contested is an editorial assessment of the evidence, not proof that studies estimate the same effect or reach directly opposing results. Populations, AI-exposure measures, outcomes and periods differ; the linked questions explain what can and cannot be compared."
    >
      {/* This module used to render a card per contested question, linking to
          exactly the same places as the questions section further down the
          page. On this lens all three are contested, so a reader met the same
          three questions twice, in two different card styles, and reasonably
          could not tell what the difference was meant to be.

          The module now states the fork and stops. The questions section below
          is the one place you enter a question. */}
      <p className="prose-measure mt-8 text-headline-regular leading-relaxed text-text-secondary">
        Read each question's mechanism, source scope, competing explanations and unresolved
        evidence. Aggregate labour indicators alone do not identify AI displacement or job creation.
      </p>
    </Band>
  );
}

/* Publication flows, not an inventory or ranking of enforceable law. */
function RuleBoard({ rows, accent }) {
  // Stable category order, equal visual weight. No ratio is calculated: the
  // latest observations may have different reference windows or query scopes.
  const INSTRUMENTS = [
    {
      id: 'derived.ai_binding_rules',
      stamp: 'RULE',
      status: 'Rule-category publications matching the query',
      rule: 'w-[2px]',
      tone: 'var(--color-text-secondary)',
      surface: 'bg-panel',
      size: 'text-title-1-medium',
      text: 'text-text-primary',
    },
    {
      id: 'derived.ai_presidential_documents',
      stamp: 'PRESIDENTIAL',
      status: 'Presidential-document publications matching the query',
      rule: 'w-[2px]',
      tone: 'var(--color-text-secondary)',
      surface: 'bg-panel',
      size: 'text-title-1-medium',
      text: 'text-text-primary',
    },
    {
      id: 'derived.ai_proposed_rules',
      stamp: 'PROPOSED',
      status: 'Proposed-rule publications matching the query',
      rule: 'w-[2px]',
      tone: 'var(--color-text-secondary)',
      surface: 'bg-panel',
      size: 'text-title-1-medium',
      text: 'text-text-primary',
    },
    {
      id: 'derived.ai_regulation_volume', stamp: 'ALL TYPES',
      status: 'All document types matching this series query; not a sum of the displayed categories',
      rule: 'w-[2px]', tone: 'var(--color-text-secondary)', surface: 'bg-panel',
      size: 'text-title-1-medium', text: 'text-text-primary',
    },
  ];

  const byId = new Map(rows.map((r) => [r.indicator_id, r]));
  const board = INSTRUMENTS.map((i) => ({ ...i, row: byId.get(i.id) })).filter(
    (i) => Number.isFinite(i.row?.latest_value)
  );
  if (board.length === 0) return null;

  const missing = INSTRUMENTS.filter((i) => !Number.isFinite(byId.get(i.id)?.latest_value));

  return (
    <Band
      accent={accent}
      eyebrow="Federal Register publication categories"
      title="Documents published, not laws currently in force."
      note="Keyword-matched US publication counts at each series' displayed reference period. Categories do not establish current legal effect, durability, enforcement, compliance cost or proposal-to-rule conversion. No cross-category percentage is inferred."
    >
      <div className="stagger mt-8 overflow-hidden rounded-2xl border border-border-button-default">
        {board.map((item, index) => (
          <a
            key={item.id}
            href={`/data/${item.id}`}
            className={`tint group flex flex-wrap items-center gap-4 border-b border-border-button-default px-5 py-4 last:border-b-0 sm:flex-nowrap ${item.surface} hover:bg-white/[0.04]`}
            style={{ '--i': index }}
          >
            <span
              className={`h-10 shrink-0 rounded-full ${item.rule}`}
              style={{ background: item.tone }}
              aria-hidden
            />

            <span
              className="shrink-0 rounded border px-2 py-0.5 text-[0.625rem] uppercase tracking-[0.14em]"
              style={{ fontFamily: 'var(--font-label)', borderColor: item.tone, color: item.tone }}
            >
              {item.stamp}
            </span>

            <span className={`figure w-16 shrink-0 text-right leading-none ${item.size} ${item.text}`}>
              {fmt(item.row.latest_value, 0)}
            </span>

            <div className="min-w-0 basis-full break-words sm:flex-1 sm:basis-0">
              <span className={`block text-body-medium ${item.text}`}>
                {item.row.label ?? item.row.name}
              </span>
              <span className="block text-caption-1-regular text-text-tertiary">{item.status}</span>
              <SnapshotDetails row={item.row} />
            </div>
          </a>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="prose-measure mt-2 text-caption-1-regular text-warn">
          {missing.map((m) => m.stamp).join(', ')}: no usable stored observation.
        </p>
      )}

      <p className="prose-measure mt-4 text-body-regular text-text-tertiary">
        Publication activity is not regulatory impact. Assess a specific document's status and
        jurisdiction from its original source; these counts cannot establish effects on AI adoption.
      </p>
    </Band>
  );
}
