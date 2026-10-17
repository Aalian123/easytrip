'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LicenceClass, PlateType, VehicleStatus, createVehicleSchema } from '@easytrip/shared';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, None } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { StatusChip } from '@/components/status-chip';
import { FormError, Input, SelectField, readEditForm } from '@/components/form';
import { VehicleFields } from '@/components/vehicle-fields';
import { Modal } from '@/components/modal';
import { LICENCE_CLASS_LABEL, oilReading, vehicleStatus } from '@/lib/status';
import { km } from '@/lib/format';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

interface VehicleRow {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  category: string;
  plateType: PlateType;
  licenceClass: LicenceClass;
  status: VehicleStatus;
  currentMileage: number;
  oil: { status: string; remainingKm: number | null };
  currentAssignment: { id: string; rider: { id: string; fullName: string } } | null;
}

function FleetList() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const status = params.get('status') ?? '';
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', status, search],
    queryFn: () =>
      api<{ rows: VehicleRow[]; total: number }>(`/vehicles${query({ status, q: search, pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Fleet"
        description="Every vehicle, what state it is in, and who has it."
        actions={
          canManageFleet(user?.role) ? (
            <Button type="button" onClick={() => setAdding(true)}>
              Add vehicle
            </Button>
          ) : null
        }
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/fleet/${row.id}`)}
        toolbar={
          <>
            <Input
              placeholder="Filter by plate, make or model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Filter vehicles"
            />
            <SelectField
              value={status}
              onChange={(event) => {
                const next = event.target.value;
                router.push(next ? `/fleet?status=${next}` : '/fleet');
              }}
              className="w-44"
            >
              <option value="">Any status</option>
              {Object.values(VehicleStatus).map((option) => (
                <option key={option} value={option}>
                  {vehicleStatus(option).label}
                </option>
              ))}
            </SelectField>
          </>
        }
        summary={data ? `${data.total} vehicle${data.total === 1 ? '' : 's'}` : null}
        empty={
          <p className="px-5 py-10 text-sm text-muted">
            {search || status ? 'No vehicles match this filter.' : 'No vehicles yet. Add the first one to start its history.'}
          </p>
        }
        columns={[
          {
            key: 'registration',
            header: 'Vehicle',
            render: (row) => (
              <PlateChip registration={row.registration} status={row.status} plateType={row.plateType} size="sm" />
            ),
          },
          {
            key: 'model',
            header: 'Make and model',
            render: (row) => (
              <span>
                <span className="font-medium text-ink">
                  {row.make} {row.model}
                </span>
                <span className="ml-2 text-xs text-muted">
                  {row.year} {row.category}
                </span>
              </span>
            ),
          },
          {
            key: 'licence',
            header: 'Licence',
            render: (row) => LICENCE_CLASS_LABEL[row.licenceClass],
          },
          { key: 'status', header: 'Status', render: (row) => <StatusChip style={vehicleStatus(row.status)} /> },
          {
            key: 'rider',
            header: 'With',
            render: (row) =>
              row.currentAssignment ? (
                <Link
                  href={`/riders/${row.currentAssignment.rider.id}`}
                  className="hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.currentAssignment.rider.fullName}
                </Link>
              ) : (
                <None />
              ),
          },
          { key: 'mileage', header: 'Mileage', numeric: true, render: (row) => km(row.currentMileage) },
          {
            key: 'oil',
            header: 'Oil',
            numeric: true,
            render: (row) => {
              const oil = oilReading(row.oil);
              return <span className={oil.tone}>{oil.text}</span>;
            },
          },
        ]}
      />

      <AddVehicleModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          client.invalidateQueries({ queryKey: ['vehicles'] });
        }}
      />
    </div>
  );
}

function AddVehicleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const save = useMutation({
    mutationFn: (form: Record<string, unknown>) => api('/vehicles', { method: 'POST', body: form }),
    onSuccess: () => {
      toast.confirm('Vehicle added to the fleet.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = createVehicleSchema.safeParse(readEditForm(event.currentTarget));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
      return;
    }
    save.mutate(parsed.data as Record<string, unknown>);
  };

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onClose())} title="Add vehicle">
      <form onSubmit={submit} className="space-y-3">
        <VehicleFields />
        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Add vehicle'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FleetPage() {
  return (
    <Suspense fallback={<div className="skeleton h-9 w-40" />}>
      <FleetList />
    </Suspense>
  );
}
