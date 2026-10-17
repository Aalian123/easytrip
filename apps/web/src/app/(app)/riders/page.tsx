'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RiderStatus, createRiderSchema } from '@easytrip/shared';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, None } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { StatusChip } from '@/components/status-chip';
import { FormError, Input, SelectField, readEditForm } from '@/components/form';
import { RiderFields } from '@/components/rider-fields';
import { Modal } from '@/components/modal';
import { riderStatus } from '@/lib/status';
import { shortDate } from '@/lib/format';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { Button } from '@/components/ui/button';

interface RiderRow {
  id: string;
  fullName: string;
  nationalId: string;
  contactNumber: string;
  status: string;
  licenceExpiresAt: string | null;
  currentAssignment: {
    id: string;
    vehicle: { id: string; registration: string; status: string };
  } | null;
}

function RiderList() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const settings = useSettings();
  const { user } = useAuth();
  const status = params.get('status') ?? '';
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['riders', status, search],
    queryFn: () => api<{ rows: RiderRow[] }>(`/riders${query({ status, q: search, pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Riders"
        description="Who drives for you, what they hold, and whether their licence is current."
        actions={
          canManageFleet(user?.role) ? (
            <Button type="button" onClick={() => setAdding(true)}>
              Add rider
            </Button>
          ) : null
        }
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/riders/${row.id}`)}
        toolbar={
          <>
            <Input
              placeholder={`Filter by name, ${settings.nationalIdLabel} or phone`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Filter riders"
            />
            <SelectField
              value={status}
              onChange={(event) => {
                const next = event.target.value;
                router.push(next ? `/riders?status=${next}` : '/riders');
              }}
              className="w-44"
            >
              <option value="">Any status</option>
              {Object.values(RiderStatus).map((option) => (
                <option key={option} value={option}>
                  {riderStatus(option).label}
                </option>
              ))}
            </SelectField>
          </>
        }
        summary={data ? `${data.rows.length} rider${data.rows.length === 1 ? '' : 's'}` : null}
        empty={
          <p className="px-5 py-10 text-sm text-muted">
            {search || status ? 'No riders match this filter.' : 'No riders yet. Add the first one to start assigning vehicles.'}
          </p>
        }
        columns={[
          {
            key: 'name',
            header: 'Rider',
            render: (row) => <span className="font-medium text-ink">{row.fullName}</span>,
          },
          {
            key: 'nationalId',
            header: settings.nationalIdLabel,
            render: (row) => <span className="tabular text-sm">{row.nationalId}</span>,
          },
          {
            key: 'contact',
            header: 'Phone',
            render: (row) => <span className="tabular text-sm">{row.contactNumber}</span>,
          },
          { key: 'status', header: 'Status', render: (row) => <StatusChip style={riderStatus(row.status)} /> },
          {
            key: 'vehicle',
            header: 'Holding',
            render: (row) =>
              row.currentAssignment ? (
                <PlateChip
                  registration={row.currentAssignment.vehicle.registration}
                  status={row.currentAssignment.vehicle.status}
                  size="sm"
                />
              ) : (
                <None />
              ),
          },
          {
            key: 'licence',
            header: 'Licence expires',
            render: (row) => {
              const expired = row.licenceExpiresAt && new Date(row.licenceExpiresAt) < new Date();
              return (
                <span className={expired ? 'font-semibold text-status-accident' : ''}>
                  {row.licenceExpiresAt ? shortDate(row.licenceExpiresAt) : <None>Not recorded</None>}
                </span>
              );
            },
          },
        ]}
      />

      <AddRiderModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          client.invalidateQueries({ queryKey: ['riders'] });
        }}
      />
    </div>
  );
}

function AddRiderModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/riders', { method: 'POST', body }),
    onSuccess: () => {
      toast.confirm('Rider added.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onClose())} title="Add rider">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const parsed = createRiderSchema.safeParse(readEditForm(event.currentTarget));
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <RiderFields />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Add rider'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RidersPage() {
  return (
    <Suspense fallback={<div className="skeleton h-9 w-40" />}>
      <RiderList />
    </Suspense>
  );
}
