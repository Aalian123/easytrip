'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { Field, FormError, Input, SelectField, Textarea, readEditForm } from '@/components/form';
import { Modal } from '@/components/modal';
import { DeleteButton } from '@/components/delete-dialog';
import { useToast } from '@/components/toast';
import { money, shortDate } from '@/lib/format';
import { sentence } from '@/lib/status';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';
import {
  DamageSeverity,
  FeatureKey,
  RepairStatus,
  ResponsibleParty,
  updateDamageSchema,
} from '@easytrip/shared';

function DamagePageScreen() {
  const settings = useSettings();
  const client = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<any | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['damages'],
    queryFn: () => api<{ rows: any[] }>(`/damages${query({ pageSize: 100 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Damage"
        description="Every damage record, and the assignment it belongs to."
      />
      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        onRowClick={canManageFleet(user?.role) ? (row) => setEditing(row) : undefined}
        columns={[
          {
            key: 'vehicle',
            header: 'Vehicle',
            // Following the plate goes to the vehicle, not into the edit form.
            render: (row) => (
              <span onClick={(event) => event.stopPropagation()}>
                <PlateChip registration={row.vehicle.registration} size="sm" href={`/fleet/${row.vehicle.id}`} />
              </span>
            ),
          },
          { key: 'detected', header: 'Detected', render: (row) => shortDate(row.detectedAt) },
          {
            key: 'what',
            header: 'Damage',
            render: (row) => (
              <span>
                {sentence(row.severity)} {sentence(row.category).toLowerCase()}
                <span className="ml-2 text-xs text-muted">{row.description}</span>
              </span>
            ),
          },
          { key: 'rider', header: 'Rider', render: (row) => row.rider?.fullName ?? '' },
          { key: 'responsible', header: 'Responsibility', render: (row) => sentence(row.responsibleParty) },
          { key: 'repair', header: 'Repair', render: (row) => sentence(row.repairStatus) },
          {
            key: 'cost',
            header: 'Cost',
            numeric: true,
            render: (row) => money(row.actualCost ?? row.estimatedCost, settings.currencySymbol),
          },
        ]}
      />

      {editing ? (
        <EditDamageModal
          damage={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            client.invalidateQueries({ queryKey: ['damages'] });
            client.invalidateQueries({ queryKey: ['vehicle-damages', editing.vehicle.id] });
          }}
        />
      ) : null}
    </div>
  );
}

function EditDamageModal({ damage, onClose, onSaved }: { damage: any; onClose: () => void; onSaved: () => void }) {
  const settings = useSettings();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  // The API refuses to reopen a write-off, so the field is shown but not sent.
  const writtenOff = damage.repairStatus === 'WRITTEN_OFF';

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/damages/${damage.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.confirm('Damage record saved.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Update damage"
      description={`${damage.vehicle.registration}, found ${shortDate(damage.detectedAt)}`}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = readEditForm(event.currentTarget);
          const parsed = updateDamageSchema.safeParse({ ...form, chargedToRider: form.chargedToRider === 'yes' });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Severity">
            <SelectField name="severity" defaultValue={damage.severity}>
              {Object.values(DamageSeverity).map((value) => (
                <option key={value} value={value}>
                  {sentence(value)}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Repair" hint={writtenOff ? 'A write-off cannot be reopened' : undefined}>
            {writtenOff ? (
              <Input value={sentence(damage.repairStatus)} disabled readOnly />
            ) : (
              <SelectField name="repairStatus" defaultValue={damage.repairStatus}>
                {Object.values(RepairStatus).map((value) => (
                  <option key={value} value={value}>
                    {sentence(value)}
                  </option>
                ))}
              </SelectField>
            )}
          </Field>
          <Field label="Responsibility">
            <SelectField name="responsibleParty" defaultValue={damage.responsibleParty}>
              {Object.values(ResponsibleParty).map((value) => (
                <option key={value} value={value}>
                  {sentence(value)}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Charged to rider">
            <SelectField name="chargedToRider" defaultValue={damage.chargedToRider ? 'yes' : 'no'}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </SelectField>
          </Field>
          <Field label={`Estimated cost (${settings.currencySymbol})`}>
            <Input name="estimatedCost" type="number" min={0} defaultValue={damage.estimatedCost ?? ''} />
          </Field>
          <Field label={`Actual cost (${settings.currencySymbol})`} hint="Once the repair is invoiced">
            <Input name="actualCost" type="number" min={0} defaultValue={damage.actualCost ?? ''} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" required defaultValue={damage.description} />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <DeleteButton kind="damage" id={damage.id} onDeleted={onSaved} className="mr-auto" />
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

export default function DamagePage() {
  return (
    <FeatureGate feature={FeatureKey.INCIDENTS}>
      <DamagePageScreen />
    </FeatureGate>
  );
}
