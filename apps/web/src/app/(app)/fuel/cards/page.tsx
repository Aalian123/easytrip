'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFuelCardSchema, FeatureKey } from '@easytrip/shared';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusChip } from '@/components/status-chip';
import { PlateChip } from '@/components/plate-chip';
import { FormError, readEditForm } from '@/components/form';
import { FuelCardFields } from '@/components/fuel-card-fields';
import { Modal } from '@/components/modal';
import { cardStatus } from '@/lib/status';
import { money, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';

function FuelCardsPageScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const settings = useSettings();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fuel-cards'],
    queryFn: () => api<{ rows: any[] }>(`/fuel/cards${query({ pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Fuel cards"
        description="Who holds which card, what it may spend, and when it expires."
        actions={
          canManageFleet(user?.role) ? (
            <Button type="button" onClick={() => setAdding(true)}>
              Add card
            </Button>
          ) : null
        }
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/fuel/cards/${row.id}`)}
        columns={[
          { key: 'card', header: 'Card', render: (row) => <span className="tabular">{row.cardNumber}</span> },
          { key: 'provider', header: 'Provider', render: (row) => row.provider },
          { key: 'status', header: 'Status', render: (row) => <StatusChip style={cardStatus(row.status)} /> },
          {
            key: 'holder',
            header: 'Held by',
            render: (row) =>
              row.currentHolder ? (
                <span className="flex items-center gap-2">
                  {row.currentHolder.rider ? row.currentHolder.rider.fullName : null}
                  {row.currentHolder.vehicle ? (
                    <PlateChip registration={row.currentHolder.vehicle.registration} size="sm" />
                  ) : null}
                </span>
              ) : (
                null
              ),
          },
          {
            key: 'daily',
            header: 'Daily limit',
            numeric: true,
            render: (row) => money(row.dailyLimit, settings.currencySymbol),
          },
          { key: 'expiry', header: 'Expires', render: (row) => shortDate(row.expiryDate) },
        ]}
      />

      {adding ? (
        <AddCardModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            client.invalidateQueries({ queryKey: ['fuel-cards'] });
          }}
        />
      ) : null}
    </div>
  );
}

function AddCardModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/fuel/cards', { method: 'POST', body }),
    onSuccess: onSaved,
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal open onOpenChange={(next) => (next ? undefined : onClose())} title="Add fuel card">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const parsed = createFuelCardSchema.safeParse(readEditForm(event.currentTarget));
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <FuelCardFields />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Add card'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FuelCardsPage() {
  return (
    <FeatureGate feature={FeatureKey.FUEL_CARDS}>
      <FuelCardsPageScreen />
    </FeatureGate>
  );
}
