'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { RecordServiceModal } from '@/components/record-service';
import { km } from '@/lib/format';
import { oilReading } from '@/lib/status';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey } from '@easytrip/shared';
import { Button } from '@/components/ui/button';

interface OilRow {
  id: string;
  registration: string;
  make: string;
  model: string;
  currentMileage: number;
  lastOilChangeDate: string | null;
  oil: { status: string; nextChangeMileage: number | null; remainingKm: number | null; intervalKm: number | null };
}

function OilPageScreen() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [changing, setChanging] = useState<OilRow | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['oil-due'], queryFn: () => api<OilRow[]>('/maintenance/oil-due') });

  return (
    <div>
      <PageHeader
        title="Oil changes"
        description="Vehicles due for an oil change, worst first. Tracked by distance; every vehicle's reading is on the Fleet list."
      />

      <DataTable
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        empty={<p className="px-5 py-10 text-sm text-muted">No vehicle needs an oil change yet.</p>}
        columns={[
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (row) => <PlateChip registration={row.registration} size="sm" href={`/fleet/${row.id}`} />,
          },
          { key: 'model', header: 'Model', render: (row) => `${row.make} ${row.model}` },
          { key: 'mileage', header: 'Mileage', numeric: true, render: (row) => km(row.currentMileage) },
          { key: 'next', header: 'Due at', numeric: true, render: (row) => km(row.oil.nextChangeMileage) },
          {
            key: 'remaining',
            header: 'Oil',
            numeric: true,
            render: (row) => {
              const oil = oilReading(row.oil);
              return <span className={oil.tone}>{oil.text}</span>;
            },
          },
          {
            key: 'action',
            header: '',
            render: (row) =>
              canManageFleet(user?.role) ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setChanging(row)}>
                  Record oil change
                </Button>
              ) : null,
          },
        ]}
      />

      {changing ? (
        <RecordServiceModal
          vehicleId={changing.id}
          type="ENGINE_OIL"
          onClose={() => setChanging(null)}
          onSaved={() => {
            setChanging(null);
            client.invalidateQueries({ queryKey: ['oil-due'] });
            client.invalidateQueries({ queryKey: ['vehicles'] });
          }}
        />
      ) : null}
    </div>
  );
}

export default function OilPage() {
  return (
    <FeatureGate feature={FeatureKey.MAINTENANCE}>
      <OilPageScreen />
    </FeatureGate>
  );
}
