'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { SelectField } from '@/components/form';
import { dateTime } from '@/lib/format';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey } from '@easytrip/shared';

function AuditPageScreen() {
  const [module, setModule] = useState('');

  const { data: modules } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: () => api<{ module: string; count: number }[]>('/audit-logs/modules'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', module],
    queryFn: () => api<{ rows: any[]; total: number }>(`/audit-logs${query({ module, pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who changed what, and what it looked like before. Read-only for everyone, including administrators."
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        toolbar={
          <SelectField value={module} onChange={(event) => setModule(event.target.value)} className="w-56">
            <option value="">Every area</option>
            {(modules ?? []).map((entry) => (
              <option key={entry.module} value={entry.module}>
                {entry.module} ({entry.count})
              </option>
            ))}
          </SelectField>
        }
        summary={data ? `${data.total} change${data.total === 1 ? '' : 's'} recorded` : null}
        columns={[
          { key: 'when', header: 'When', render: (row) => dateTime(row.createdAt) },
          { key: 'who', header: 'Who', render: (row) => row.user?.name ?? row.userLabel ?? 'system' },
          { key: 'action', header: 'Action', render: (row) => row.action },
          { key: 'module', header: 'Area', render: (row) => row.module },
          { key: 'record', header: 'Record', render: (row) => row.recordType },
          {
            key: 'change',
            header: 'Changed',
            render: (row) => {
              if (!row.before || !row.after) return null;
              const changed = Object.keys(row.after).filter(
                (key) => JSON.stringify(row.after[key]) !== JSON.stringify(row.before?.[key]),
              );
              return <span className="text-xs text-muted">{changed.slice(0, 4).join(', ')}</span>;
            },
          },
        ]}
      />
    </div>
  );
}

export default function AuditPage() {
  return (
    <FeatureGate feature={FeatureKey.AUDIT}>
      <AuditPageScreen />
    </FeatureGate>
  );
}
