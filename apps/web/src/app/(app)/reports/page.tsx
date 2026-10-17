'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, downloadFile, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Field, Input, SelectField } from '@/components/form';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey } from '@easytrip/shared';
import { Button } from '@/components/ui/button';

interface ReportMeta {
  key: string;
  title: string;
  description: string;
  columns: { key: string; label: string; numeric?: boolean }[];
}

function ReportsPageScreen() {
  const [selected, setSelected] = useState<string>('vehicle-inventory');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { data: catalogue } = useQuery({
    queryKey: ['report-catalogue'],
    queryFn: () => api<ReportMeta[]>('/reports'),
  });

  const filters = query({ from, to });
  const { data: report, isFetching } = useQuery({
    queryKey: ['report', selected, from, to],
    queryFn: () => api<{ title: string; columns: ReportMeta['columns']; rows: Record<string, unknown>[] }>(
      `/reports/${selected}${filters}`,
    ),
    enabled: Boolean(selected),
  });

  const download = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try {
      await downloadFile(
        `/reports/${selected}${query({ from, to, format })}`,
        `${selected}-${new Date().toISOString().slice(0, 10)}.${format}`,
      );
    } finally {
      setBusy(null);
    }
  };

  const meta = catalogue?.find((entry) => entry.key === selected);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Filter, read on screen, then take it away as a spreadsheet or a PDF."
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => download('xlsx')} disabled={busy !== null}>
              {busy === 'xlsx' ? 'Preparing' : 'Export to Excel'}
            </Button>
            <Button type="button" variant="outline" onClick={() => download('pdf')} disabled={busy !== null}>
              {busy === 'pdf' ? 'Preparing' : 'Export to PDF'}
            </Button>
          </div>
        }
      />

      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Report">
          <SelectField value={selected} onChange={(event) => setSelected(event.target.value)}>
            {(catalogue ?? []).map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.title}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>

      {meta ? <p className="mb-3 max-w-prose text-sm text-muted">{meta.description}</p> : null}

      <div className="panel overflow-hidden">
        {isFetching ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-5 w-full" />
            ))}
          </div>
        ) : !report || report.rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted">Nothing matches those filters.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
          <table className="ledger">
            <thead>
              <tr>
                {report.columns.map((column) => (
                  <th key={column.key} className={column.numeric ? 'text-right' : undefined}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index}>
                  {report.columns.map((column) => (
                    <td key={column.key} className={column.numeric ? 'text-right tabular' : undefined}>
                      {String(row[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {report && report.rows.length > 0 ? (
          <div className="border-t border-line px-4 py-2 text-xs text-muted">
            {report.rows.length} row{report.rows.length === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <FeatureGate feature={FeatureKey.REPORTS}>
      <ReportsPageScreen />
    </FeatureGate>
  );
}
