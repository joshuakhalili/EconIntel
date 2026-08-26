import {
  RiDatabase2Line,
  RiFileTextLine,
  RiLineChartLine,
  RiGlobalLine,
} from '@remixicon/react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/base/table/table';
import StatTiles from '@/components/StatTiles';
import { Chip } from '@/components/base/badges/chip';
import { useStatus } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock, Section } from '@/components/Page';
import { fmt } from '@/lib/format';

/**
 * Where the numbers come from.
 *
 * This page exists because a dashboard that will not show its own plumbing is
 * asking to be trusted rather than checked. It reports what is stored, when
 * each source last ran, and which integrations are configured — including the
 * ones that are not.
 */
export default function PipelinePage() {
  const { data: status, isPending, isError, error } = useStatus();

  usePageTitle('Where this comes from', 'Sources, ingestion runs and coverage');

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="the pipeline status" />;

  const { counts, recentRuns, staleIndicators, integrations } = status;

  const stats = [
    { icon: RiDatabase2Line, label: 'Observations', value: fmt(counts.observations, 0) },
    { icon: RiLineChartLine, label: 'Indicators', value: fmt(counts.indicators, 0) },
    { icon: RiFileTextLine, label: 'Documents', value: fmt(counts.documents, 0) },
    { icon: RiGlobalLine, label: 'Countries', value: fmt(counts.countries, 0) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Section>
        <StatTiles stats={stats} />
      </Section>

      <Section
        title="Integrations"
        caption="A source with no key configured is listed, not hidden — an absent number and an unconfigured source are different problems."
      >
        <Table aria-label="Integrations">
          <TableHeader>
            <TableColumn id="name" isRowHeader>Source</TableColumn>
            <TableColumn id="state">State</TableColumn>
            <TableColumn id="note">Note</TableColumn>
          </TableHeader>
          <TableBody>
            {integrations.map((integration) => (
              <TableRow key={integration.name} id={integration.name}>
                <TableCell>{integration.name}</TableCell>
                <TableCell>
                  <Chip variant="caption" color={integration.ready ? 'lime' : 'neutral'}>
                    {integration.ready ? 'Configured' : 'Not configured'}
                  </Chip>
                </TableCell>
                <TableCell className="text-text-tertiary">{integration.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Recent ingestion runs">
        {recentRuns.length === 0 ? (
          <EmptyBlock>No runs recorded yet.</EmptyBlock>
        ) : (
          <Table aria-label="Recent ingestion runs">
            <TableHeader>
              <TableColumn id="job" isRowHeader>Job</TableColumn>
              <TableColumn id="status">Status</TableColumn>
              <TableColumn id="rows">Rows</TableColumn>
              <TableColumn id="finished">Finished</TableColumn>
            </TableHeader>
            <TableBody>
              {recentRuns.map((run, i) => (
                <TableRow key={`${run.job_name}-${run.started_at}-${i}`} id={`${run.job_name}-${i}`}>
                  <TableCell className="font-mono text-caption-regular">{run.job_name}</TableCell>
                  <TableCell>
                    <Chip variant="caption" color={runColor(run.status)}>
                      {run.status}
                    </Chip>
                  </TableCell>
                  <TableCell className="tabular-nums">{run.rows_written ?? '—'}</TableCell>
                  <TableCell className="text-text-tertiary">
                    {run.finished_at
                      ? new Date(run.finished_at).toLocaleString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'still running'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Stale indicators"
        caption="Series whose most recent observation is older than their expected cadence."
      >
        {staleIndicators.length === 0 ? (
          <EmptyBlock>Nothing stale — every series is within its expected cadence.</EmptyBlock>
        ) : (
          <Table aria-label="Stale indicators">
            <TableHeader>
              <TableColumn id="indicator" isRowHeader>Indicator</TableColumn>
              <TableColumn id="last">Last observation</TableColumn>
            </TableHeader>
            <TableBody>
              {staleIndicators.map((row) => (
                <TableRow key={row.id ?? row.indicator_id} id={row.id ?? row.indicator_id}>
                  <TableCell>{row.name ?? row.id ?? row.indicator_id}</TableCell>
                  <TableCell className="text-text-tertiary">
                    {row.last_observation ?? row.latest_date ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

function runColor(status) {
  if (status === 'succeeded') return 'lime';
  if (status === 'failed') return 'rose';
  return 'yellow';
}
