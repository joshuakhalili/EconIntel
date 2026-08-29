import { Link } from 'react-router-dom';
import { fmt, displayUnit } from '@/lib/format';

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

/** Percentage change between the last two observations, or null. */
function delta(row) {
  if (!Number.isFinite(row.latest_value) || !Number.isFinite(row.previous_value)) return null;
  if (row.previous_value === 0) return null;
  return ((row.latest_value - row.previous_value) / Math.abs(row.previous_value)) * 100;
}

function Band({ children, accent, eyebrow, title, note }) {
  return (
    <section className="relative mt-14 overflow-hidden rounded-3xl border border-border-button-default">
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
  const chips = rows.find((r) => /semiconductor/i.test(r.name));
  const hosting = rows.find((r) => /data processing|hosting/i.test(r.name));
  if (!chips || !hosting) return null;

  return (
    <Band
      accent={accent}
      eyebrow="The divergence"
      title="Computation got cheaper. Renting it did not."
      note="Both are US producer price indices, both rebased to 100 at their own start. They are not on a shared axis here because they do not share a base year — the point is the direction, not the gap."
    >
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2">
        {[
          { row: chips, label: 'Semiconductors', since: 'since Dec 1998' },
          { row: hosting, label: 'Data processing and hosting', since: 'since Dec 2000' },
        ].map(({ row, label, since }) => {
          const rising = row.latest_value >= 100;
          return (
            <div key={row.indicator_id} className="bg-panel p-6 sm:p-8">
              <p className="text-caption-1-medium text-text-secondary">{label}</p>
              <p
                className="figure mt-3 text-[clamp(2.75rem,7vw,4.5rem)] leading-none"
                style={{ color: rising ? 'var(--color-warn)' : accent.hex }}
              >
                {fmt(row.latest_value, row.decimals ?? 1)}
              </p>
              <p className="mt-2 text-caption-1-regular text-text-tertiary">
                {rising ? 'above' : 'below'} its base of 100 {since}
              </p>
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
    .map((r) => ({ ...r, d: delta(r) }))
    .filter((r) => Number.isFinite(r.latest_value))
    .slice(0, 6);
  if (board.length === 0) return null;

  return (
    <Band
      accent={accent}
      eyebrow="What it is built from"
      title="A data centre is copper, concrete and power before it is software."
      note="The physical inputs this build-out competes for, at their latest published price. Movement is against the previous period, not a forecast."
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
            <p className="mt-1 flex items-center gap-2 text-caption-1-regular">
              {Number.isFinite(row.d) && (
                <span className={row.d >= 0 ? 'text-pos' : 'text-neg'}>
                  {row.d >= 0 ? '↑' : '↓'} {Math.abs(row.d).toFixed(1)}%
                </span>
              )}
              <span className="text-text-tertiary">{displayUnit(row.unit)}</span>
            </p>
          </div>
        ))}
      </div>
    </Band>
  );
}

/* ── Growth & Productivity ────────────────────────────────────────────────
   Adoption rates, which is the one place on the site where a diffusion curve
   is literally what the data is. Ranked bars read that spread faster than a
   line chart with sixteen series on it. */
function AdoptionSpread({ rows, accent }) {
  const board = rows
    .filter((r) => Number.isFinite(r.latest_value) && /percent|%|enterprise|share/i.test(r.unit ?? ''))
    .sort((a, b) => b.latest_value - a.latest_value);
  if (board.length === 0) return null;

  const ceiling = Math.max(...board.map((r) => r.latest_value), 1);

  return (
    <Band
      accent={accent}
      eyebrow="How far it has spread"
      title="Adoption is wide. Whether it has moved output is the harder question."
      note="Share of firms reporting use, from national statistical surveys. Levels are not comparable between survey families — read the ordering, not the gaps."
    >
      <div className="mt-8 flex flex-col gap-3">
        {board.map((row) => (
          <div key={row.indicator_id} className="flex items-center gap-4">
            <span className="w-44 shrink-0 truncate text-caption-1-regular text-text-secondary">
              {row.label ?? row.name}
            </span>
            <span className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/5">
              <span
                className="absolute inset-y-0 left-0 rounded-md"
                style={{
                  width: `${(row.latest_value / ceiling) * 100}%`,
                  background: `linear-gradient(90deg, ${accent.glow}, ${accent.hex})`,
                }}
              />
            </span>
            <span className="figure w-16 shrink-0 text-right text-caption-1-medium text-text-primary">
              {fmt(row.latest_value, 1)}%
            </span>
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

  return (
    <Band
      accent={accent}
      eyebrow="Where this lens stands"
      title={`All ${questions.length} questions here are contested.`}
      note="Credible sources reach opposite conclusions from the same period. Firm-level panels find employment growing fastest at the most AI-exposed companies; local-labour-market studies find it falling in exposed occupations. Neither settles the other, and the disagreement is reported rather than resolved."
    >
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
        {contested.map((q) => (
          <Link
            key={q.id}
            to={`/q/${q.slug}`}
            className="group bg-panel p-6 transition-colors hover:bg-raised"
          >
            <p className="text-title-3-medium leading-snug text-text-primary">{q.question}</p>
            <p className="mt-2 text-caption-1-regular text-text-tertiary">
              {q.indicator_count} indicators
            </p>
            <p className="mt-4 flex items-center gap-2 text-caption-1-medium" style={{ color: accent.hex }}>
              Read the disagreement
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </p>
          </Link>
        ))}
      </div>
    </Band>
  );
}

/* ── Policy & Regulation ──────────────────────────────────────────────────
   Counts of discrete instruments, not a continuous series. The distinction
   that matters is enforceability: a Rule binds, a Proposed Rule leads a Rule by
   a year or two where it converts at all, and an Executive Action is
   reversible by the next administration. Counting them together would make
   attention look like law. This is also the thinnest lens on the site and the
   module says so rather than padding. */
function RuleBoard({ rows, accent }) {
  const board = rows.filter((r) => Number.isFinite(r.latest_value));
  if (board.length === 0) return null;

  return (
    <Band
      accent={accent}
      eyebrow="What is actually binding"
      title="Mostly proposing, not enacting."
      note="Counted separately on purpose. A Rule is enforceable; a Proposed Rule carries a comment period and leads a Rule by 12 to 24 months where it converts at all; an Executive Action is unilateral and reversible."
    >
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {board.map((row) => (
          <div key={row.indicator_id} className="bg-panel p-6">
            <p className="figure text-[2.5rem] leading-none text-text-primary">
              {fmt(row.latest_value, 0)}
            </p>
            <p className="mt-2 text-caption-1-medium text-text-secondary">
              {row.label ?? row.name}
            </p>
          </div>
        ))}
      </div>
      <p className="prose-measure mt-6 text-body-regular text-text-tertiary">
        This is the thinnest lens on the site — four indicators, one question, and two more declared
        but never computed. It is listed as evidence-insufficient for that reason rather than
        because governments are inactive.
      </p>
    </Band>
  );
}
