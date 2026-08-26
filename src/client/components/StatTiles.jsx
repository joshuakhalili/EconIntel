/**
 * A row of count tiles.
 *
 * BoardUI's StatCards always renders a delta chip beside the value, which is
 * right for a KPI that moved and wrong here: these are absolute row counts with
 * no stored previous value to compare against. Rather than invent a change
 * figure to fill the pill, this mirrors the same tile treatment — 2xl radius,
 * secondary surface, tinted icon square — and omits it.
 */
export default function StatTiles({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <section
          key={stat.label}
          className="flex h-[132px] min-w-0 flex-col items-start justify-between rounded-2xl bg-background-secondary-default p-4"
        >
          <span className="flex items-center rounded-md bg-stat-card-icon-background p-1.5">
            <stat.icon className="size-5 shrink-0 text-foreground-icon-primary" aria-hidden />
          </span>
          <div className="flex w-full flex-col gap-0.5">
            <p className="w-full text-body-medium text-text-secondary">{stat.label}</p>
            <p className="text-title-1-medium whitespace-nowrap tabular-nums text-text-primary">
              {stat.value}
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}
