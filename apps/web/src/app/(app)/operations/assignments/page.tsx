'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, None } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { SelectField } from '@/components/form';
import { km, money, relativeDays, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey } from '@easytrip/shared';

interface AssignmentRow {
  id: string;
  status: string;
  assignedAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  startMileage: number;
  endMileage: number | null;
  vehicle: { id: string; registration: string; status: string };
  rider: { id: string; fullName: string };
  rentalCharge: { totalAmount: string; paymentStatus: string } | null;
}

function AssignmentList() {
  const params = useSearchParams();
  const router = useRouter();
  const settings = useSettings();
  const status = params.get('status') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', status],
    queryFn: () =>
      api<{ rows: AssignmentRow[] }>(
        `/assignments${query(status === 'OVERDUE' ? { overdue: 'true', pageSize: 100 } : { status, pageSize: 100 })}`,
      ),
  });

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Every handover and return, with the distance covered and what it was billed."
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/operations/assignments/${row.id}`)}
        toolbar={
          <SelectField
            value={status}
            onChange={(event) => {
              const next = event.target.value;
              router.push(next ? `/operations/assignments?status=${next}` : '/operations/assignments');
            }}
            className="w-44"
          >
            <option value="">All assignments</option>
            <option value="ACTIVE">On the road</option>
            <option value="OVERDUE">Overdue</option>
            <option value="RETURNED">Returned</option>
          </SelectField>
        }
        summary={data ? `${data.rows.length} assignment${data.rows.length === 1 ? '' : 's'}` : null}
        columns={[
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (row) => <PlateChip registration={row.vehicle.registration} status={row.vehicle.status} size="sm" />,
          },
          { key: 'rider', header: 'Rider', render: (row) => row.rider.fullName },
          { key: 'assignedAt', header: 'Assigned', render: (row) => shortDate(row.assignedAt) },
          {
            key: 'due',
            header: 'Due back',
            render: (row) => {
              if (row.status !== 'ACTIVE') return <span className="text-muted">{shortDate(row.returnedAt)}</span>;
              if (!row.expectedReturnAt) return <span className="text-muted">open ended</span>;
              const late = new Date(row.expectedReturnAt) < new Date();
              return (
                <span className={late ? 'font-semibold text-status-accident' : ''}>{relativeDays(row.expectedReturnAt)}</span>
              );
            },
          },
          {
            key: 'distance',
            header: 'Distance',
            numeric: true,
            render: (row) => (row.endMileage != null ? km(row.endMileage - row.startMileage) : <None />),
          },
          {
            key: 'charge',
            header: 'Billed',
            numeric: true,
            render: (row) =>
              row.rentalCharge ? money(row.rentalCharge.totalAmount, settings.currencySymbol) : <None />,
          },
        ]}
      />
    </div>
  );
}

function AssignmentsPageScreen() {
  return (
    <Suspense fallback={<div className="skeleton h-9 w-40" />}>
      <AssignmentList />
    </Suspense>
  );
}

export default function AssignmentsPage() {
  return (
    <FeatureGate feature={FeatureKey.ASSIGNMENTS}>
      <AssignmentsPageScreen />
    </FeatureGate>
  );
}
