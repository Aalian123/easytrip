'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { Field, FormError, Input } from '@/components/form';
import { Modal } from '@/components/modal';
import { money, shortDate } from '@/lib/format';
import { sentence } from '@/lib/status';
import { useSettings } from '@/lib/settings-context';
import { canManageMoney, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey } from '@easytrip/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function RentalsPageScreen() {
  const settings = useSettings();
  const client = useQueryClient();
  const { user } = useAuth();
  const [paying, setPaying] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rentals'],
    queryFn: () => api<{ rows: any[]; billed: number; collected: number }>(`/rentals${query({ pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader title="Rentals" description="What each return was billed, and what has been collected." />

      <div className="panel mb-5 grid max-w-2xl overflow-hidden divide-line sm:grid-cols-3 sm:divide-x">
        <div className="px-5 py-4">
          <p className="text-xs text-muted">Billed</p>
          <p className="tabular mt-1 text-xl font-bold text-navy">
            {money(data?.billed ?? 0, settings.currencySymbol)}
          </p>
        </div>
        <div className="border-t border-line px-5 py-4 sm:border-t-0">
          <p className="text-xs text-muted">Collected</p>
          <p className="tabular mt-1 text-xl font-bold text-navy">
            {money(data?.collected ?? 0, settings.currencySymbol)}
          </p>
        </div>
        <div className="border-t border-line px-5 py-4 sm:border-t-0">
          <p className="text-xs text-muted">Rent still owed</p>
          <p
            className={
              (data?.billed ?? 0) - (data?.collected ?? 0) > 0
                ? 'tabular mt-1 text-xl font-bold text-status-accident'
                : 'tabular mt-1 text-xl font-bold text-navy'
            }
          >
            {money((data?.billed ?? 0) - (data?.collected ?? 0), settings.currencySymbol)}
          </p>
        </div>
      </div>

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (row) => <PlateChip registration={row.vehicle.registration} size="sm" />,
          },
          { key: 'rider', header: 'Rider', render: (row) => row.assignment.rider.fullName },
          { key: 'returned', header: 'Returned', render: (row) => shortDate(row.assignment.returnedAt) },
          { key: 'days', header: 'Days', numeric: true, render: (row) => row.billedDays },
          {
            key: 'total',
            header: 'Total',
            numeric: true,
            render: (row) => money(row.totalAmount, settings.currencySymbol),
          },
          {
            key: 'paid',
            header: 'Paid',
            numeric: true,
            render: (row) => money(row.paidAmount, settings.currencySymbol),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Badge
                variant={
                  row.paymentStatus === 'PAID' ? 'success' : row.paymentStatus === 'PARTIAL' ? 'warning' : 'danger'
                }
                size="sm"
              >
                {sentence(row.paymentStatus)}
              </Badge>
            ),
          },
          {
            key: 'action',
            header: '',
            render: (row) =>
              canManageMoney(user?.role) && row.paymentStatus !== 'PAID' ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setPaying(row)}>
                  Record payment
                </Button>
              ) : null,
          },
        ]}
      />

      {paying ? (
        <PaymentModal
          charge={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            client.invalidateQueries({ queryKey: ['rentals'] });
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentModal({ charge, onClose, onSaved }: { charge: any; onClose: () => void; onSaved: () => void }) {
  const settings = useSettings();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const outstanding = Number(charge.totalAmount) - Number(charge.paidAmount);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/rentals/${charge.id}/payments`, { method: 'POST', body }),
    onSuccess: () => {
      toast.confirm('Payment recorded.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Record payment"
      description={`${money(outstanding, settings.currencySymbol)} outstanding on this rental.`}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = new FormData(event.currentTarget);
          save.mutate({ amount: Number(form.get('amount')) });
        }}
      >
        <Field label="Amount received">
          <Input name="amount" type="number" step="0.01" required defaultValue={outstanding} />
        </Field>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Record payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RentalsPage() {
  return (
    <FeatureGate feature={FeatureKey.RENTALS}>
      <RentalsPageScreen />
    </FeatureGate>
  );
}
