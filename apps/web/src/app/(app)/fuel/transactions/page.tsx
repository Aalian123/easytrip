'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFuelTransactionSchema, FeatureKey } from '@easytrip/shared';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { Field, FormError, Input, SelectField } from '@/components/form';
import { Modal } from '@/components/modal';
import { dateTime, money } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';

function FuelTransactionsPageScreen() {
  const settings = useSettings();
  const client = useQueryClient();
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fuel-transactions'],
    queryFn: () => api<{ rows: any[] }>(`/fuel/transactions${query({ pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Fuel purchases"
        description="Each purchase checked against the card's limits as it is entered."
        actions={
          user?.role !== 'VIEWER' ? (
            <Button type="button" onClick={() => setRecording(true)}>
              Record purchase
            </Button>
          ) : null
        }
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        columns={[
          { key: 'when', header: 'When', render: (row) => dateTime(row.occurredAt) },
          { key: 'card', header: 'Card', render: (row) => <span className="tabular">{row.fuelCard.cardNumber}</span> },
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (row) =>
              row.vehicle ? <PlateChip registration={row.vehicle.registration} size="sm" /> : null,
          },
          { key: 'rider', header: 'Rider', render: (row) => row.rider?.fullName ?? '' },
          { key: 'station', header: 'Station', render: (row) => row.station ?? '' },
          { key: 'litres', header: 'Litres', numeric: true, render: (row) => Number(row.litres).toFixed(1) },
          {
            key: 'amount',
            header: 'Amount',
            numeric: true,
            render: (row) => (
              <span className={row.flagged ? 'text-status-accident' : ''}>
                {money(row.amount, settings.currencySymbol)}
              </span>
            ),
          },
          {
            key: 'flag',
            header: 'Over limit',
            render: (row) => (row.flagged ? <span className="text-xs text-status-accident">{row.flagReason}</span> : ''),
          },
        ]}
      />

      {recording ? (
        <RecordPurchaseModal
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            client.invalidateQueries({ queryKey: ['fuel-transactions'] });
          }}
        />
      ) : null}
    </div>
  );
}

function RecordPurchaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { data: cards } = useQuery({
    queryKey: ['fuel-cards', 'picker'],
    queryFn: () => api<{ rows: any[] }>(`/fuel/cards${query({ pageSize: 200 })}`),
  });
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'picker'],
    queryFn: () => api<{ rows: any[] }>(`/vehicles${query({ pageSize: 200 })}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/fuel/transactions', { method: 'POST', body }),
    onSuccess: onSaved,
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal open onOpenChange={(next) => (next ? undefined : onClose())} title="Record fuel purchase">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = Object.fromEntries(new FormData(event.currentTarget).entries());
          const cleaned = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
          const parsed = createFuelTransactionSchema.safeParse(cleaned);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fuel card">
            <SelectField name="fuelCardId" required defaultValue="">
              <option value="">Choose a card</option>
              {(cards?.rows ?? []).map((card) => (
                <option key={card.id} value={card.id}>
                  {card.cardNumber}  {card.provider}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Vehicle">
            <SelectField name="vehicleId" defaultValue="">
              <option value="">From the card holder</option>
              {(vehicles?.rows ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Litres">
            <Input name="litres" type="number" step="0.01" required />
          </Field>
          <Field label="Amount">
            <Input name="amount" type="number" step="0.01" required />
          </Field>
          <Field label="Station">
            <Input name="station" />
          </Field>
          <Field label="Odometer reading">
            <Input name="vehicleMileage" type="number" />
          </Field>
          <Field label="Receipt link" className="sm:col-span-2">
            <Input name="receiptUrl" placeholder="https://drive.google.com/..." />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Record purchase'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FuelTransactionsPage() {
  return (
    <FeatureGate feature={FeatureKey.FUEL_TRANSACTIONS}>
      <FuelTransactionsPageScreen />
    </FeatureGate>
  );
}
