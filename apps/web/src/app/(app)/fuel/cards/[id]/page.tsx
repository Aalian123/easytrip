'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { StatusChip } from '@/components/status-chip';
import { PageHeader } from '@/components/page-header';
import { Fact, Facts } from '@/components/facts';
import { FuelCardFields } from '@/components/fuel-card-fields';
import { PlateChip } from '@/components/plate-chip';
import { Field, FormError, Input, SelectField, readEditForm } from '@/components/form';
import { Modal } from '@/components/modal';
import { DeleteButton } from '@/components/delete-dialog';
import { cardStatus } from '@/lib/status';
import { dateTime, money, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey, updateFuelCardSchema } from '@easytrip/shared';
import { Button } from '@/components/ui/button';

function FuelCardPageScreen() {
  const params = useParams<{ id: string }>();
  const settings = useSettings();
  const client = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [issuing, setIssuing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: card } = useQuery({
    queryKey: ['fuel-card', params.id],
    queryFn: () => api<any>(`/fuel/cards/${params.id}`),
  });

  const release = useMutation({
    mutationFn: () => api(`/fuel/cards/${params.id}/release`, { method: 'POST' }),
    onSuccess: () => {
      toast.confirm('Card released. It is back in the pool.');
      client.invalidateQueries({ queryKey: ['fuel-card', params.id] });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  if (!card) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        crumbs={[
          { href: '/fuel/cards', label: 'Fuel cards' },
          { label: card.cardNumber },
        ]}
        title={card.cardNumber}
        status={
          <>
            <StatusChip style={cardStatus(card.status)} />
            <span className="text-sm text-muted">{card.provider}</span>
          </>
        }
        actions={
          canManageFleet(user?.role) ? (
            <>
              {card.currentHolder ? (
                <Button type="button" variant="outline" onClick={() => release.mutate()}>
                  Release card
                </Button>
              ) : (
                <Button type="button" onClick={() => setIssuing(true)}>
                  Issue card
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Edit card
              </Button>
              <DeleteButton kind="fuel-card" id={card.id} onDeleted={() => router.push('/fuel/cards')} />
            </>
          ) : null
        }
      />

      <FormError message={error} />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-4">
          <Facts>
            <Fact label="Expires" value={card.expiryDate ? shortDate(card.expiryDate) : null} tabular />
            <Fact label="Daily limit" value={card.dailyLimit ? money(card.dailyLimit, settings.currencySymbol) : null} tabular hideEmpty />
            <Fact label="Weekly limit" value={card.weeklyLimit ? money(card.weeklyLimit, settings.currencySymbol) : null} tabular hideEmpty />
            <Fact label="Monthly limit" value={card.monthlyLimit ? money(card.monthlyLimit, settings.currencySymbol) : null} tabular hideEmpty />
          </Facts>
          {card.notes ? <p className="panel px-3 py-2 text-sm text-muted">{card.notes}</p> : null}

          <div className="panel text-sm">
            <p className="border-b border-line px-3 py-2 text-xs font-medium text-muted">Spend so far</p>
            <div className="divide-y divide-line">
              {card.usage?.windows.map((window: any) => (
                <div key={window.window} className="flex items-baseline justify-between px-3 py-1.5">
                  <span className="text-xs text-muted">{window.window}</span>
                  <span className={`tabular text-sm ${window.exceeded ? 'text-status-accident' : ''}`}>
                    {money(window.used, settings.currencySymbol)}
                    {window.limit != null ? (
                      <span className="text-muted"> of {money(window.limit, settings.currencySymbol)}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-base font-semibold">Who has held this card</h2>
            <div className="panel divide-y divide-line">
              {card.assignments.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">This card has never been issued.</p>
              ) : (
                card.assignments.map((assignment: any) => (
                  <div key={assignment.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm">
                      {assignment.rider?.fullName ?? 'Vehicle only'}
                      {assignment.vehicle ? (
                        <PlateChip registration={assignment.vehicle.registration} size="sm" />
                      ) : null}
                    </span>
                    <span className="text-xs text-muted">
                      {shortDate(assignment.assignedAt)} →{' '}
                      {assignment.releasedAt ? shortDate(assignment.releasedAt) : 'still held'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Recent purchases</h2>
            <div className="panel divide-y divide-line">
              {card.transactions.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">No fuel purchased on this card yet.</p>
              ) : (
                card.transactions.map((transaction: any) => (
                  <div key={transaction.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                    <span className="text-sm">
                      {dateTime(transaction.occurredAt)}
                      <span className="ml-2 text-xs text-muted">{transaction.station ?? ''}</span>
                    </span>
                    <span className="flex gap-4 text-sm">
                      <span className="tabular text-muted">{Number(transaction.litres)} L</span>
                      <span className={`tabular ${transaction.flagged ? 'text-status-accident' : ''}`}>
                        {money(transaction.amount, settings.currencySymbol)}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {issuing ? (
        <IssueCardModal
          cardId={card.id}
          onClose={() => setIssuing(false)}
          onSaved={() => {
            setIssuing(false);
            client.invalidateQueries({ queryKey: ['fuel-card', params.id] });
          }}
        />
      ) : null}

      {editing ? (
        <EditCardModal
          card={card}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            client.invalidateQueries({ queryKey: ['fuel-card', params.id] });
            client.invalidateQueries({ queryKey: ['fuel-cards'] });
          }}
        />
      ) : null}
    </div>
  );
}

/** ASSIGNED is set by issuing the card, so it is not offered here. */
const EDITABLE_CARD_STATUSES = ['AVAILABLE', 'BLOCKED', 'LOST', 'EXPIRED', 'INACTIVE'];

function EditCardModal({ card, onClose, onSaved }: { card: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const held = Boolean(card.currentHolder);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/fuel/cards/${card.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.confirm('Fuel card saved.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal open onOpenChange={(next) => (next ? undefined : onClose())} title="Edit fuel card">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const parsed = updateFuelCardSchema.safeParse(readEditForm(event.currentTarget));
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <FuelCardFields card={card}>
          <Field label="Status" hint={held ? 'Release the card to change its status' : undefined}>
            {held ? (
              <Input value={cardStatus(card.status).label} disabled readOnly />
            ) : (
              <SelectField name="status" defaultValue={card.status}>
                {EDITABLE_CARD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {cardStatus(status).label}
                  </option>
                ))}
              </SelectField>
            )}
          </Field>
        </FuelCardFields>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function IssueCardModal({
  cardId,
  onClose,
  onSaved,
}: {
  cardId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { data: riders } = useQuery({
    queryKey: ['riders', 'picker', 'ACTIVE'],
    queryFn: () => api<{ rows: any[] }>(`/riders${query({ status: 'ACTIVE', pageSize: 200 })}`),
  });
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'picker'],
    queryFn: () => api<{ rows: any[] }>(`/vehicles${query({ pageSize: 200 })}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/fuel/cards/${cardId}/assign`, { method: 'POST', body }),
    onSuccess: onSaved,
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Issue fuel card"
      description="Held by a rider, a vehicle, or both. The holding history is kept."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = new FormData(event.currentTarget);
          save.mutate({
            riderId: form.get('riderId') || null,
            vehicleId: form.get('vehicleId') || null,
          });
        }}
      >
        <Field label="Rider">
          <SelectField name="riderId" defaultValue="">
            <option value="">No rider</option>
            {(riders?.rows ?? []).map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.fullName}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Vehicle">
          <SelectField name="vehicleId" defaultValue="">
            <option value="">No vehicle</option>
            {(vehicles?.rows ?? []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration}  {vehicle.make} {vehicle.model}
              </option>
            ))}
          </SelectField>
        </Field>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Issuing…' : 'Issue card'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FuelCardPage() {
  return (
    <FeatureGate feature={FeatureKey.FUEL_CARDS}>
      <FuelCardPageScreen />
    </FeatureGate>
  );
}
