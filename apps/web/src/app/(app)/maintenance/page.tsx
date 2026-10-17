'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FeatureKey } from '@easytrip/shared';
import { api, query } from '@/lib/api';
import { PageHeader, SectionTitle } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { RecordServiceModal } from '@/components/record-service';
import { sentence } from '@/lib/status';
import { km, money, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';

function MaintenancePageScreen() {
  const settings = useSettings();
  const { user } = useAuth();
  const client = useQueryClient();
  const [recording, setRecording] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => api<{ rows: any[] }>(`/maintenance${query({ pageSize: 100 })}`),
  });
  const { data: upcoming } = useQuery({
    queryKey: ['maintenance-upcoming'],
    queryFn: () => api<any[]>('/maintenance/upcoming'),
  });

  return (
    <div>
      <PageHeader
        title="Service history"
        description="Every service, oil changes included, kept as a permanent record."
        actions={
          canManageFleet(user?.role) ? (
            <Button type="button" onClick={() => setRecording(true)}>
              Record service
            </Button>
          ) : null
        }
      />

      {upcoming && upcoming.length > 0 ? (
        <section className="mb-6">
          <SectionTitle>Coming up</SectionTitle>
          <div className="panel divide-y divide-line overflow-hidden">
            {upcoming.slice(0, 5).map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="flex items-center gap-3 text-sm text-ink">
                  <PlateChip registration={record.vehicle.registration} size="sm" />
                  {sentence(record.type)}
                </span>
                <span className="text-xs text-muted">
                  {record.nextServiceDate ? shortDate(record.nextServiceDate) : ''}
                  {record.nextServiceMileage ? ` at ${km(record.nextServiceMileage)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (row) => <PlateChip registration={row.vehicle.registration} size="sm" href={`/fleet/${row.vehicle.id}`} />,
          },
          { key: 'type', header: 'Work done', render: (row) => sentence(row.type) },
          { key: 'date', header: 'Date', render: (row) => shortDate(row.performedAt) },
          { key: 'mileage', header: 'Mileage', numeric: true, render: (row) => km(row.mileage) },
          { key: 'provider', header: 'Provider', render: (row) => row.serviceProvider ?? '' },
          {
            key: 'cost',
            header: 'Cost',
            numeric: true,
            render: (row) => money(row.cost, settings.currencySymbol),
          },
        ]}
      />

      {recording ? (
        <RecordServiceModal
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            client.invalidateQueries({ queryKey: ['maintenance'] });
            client.invalidateQueries({ queryKey: ['maintenance-upcoming'] });
          }}
        />
      ) : null}
    </div>
  );
}

export default function MaintenancePage() {
  return (
    <FeatureGate feature={FeatureKey.MAINTENANCE}>
      <MaintenancePageScreen />
    </FeatureGate>
  );
}
