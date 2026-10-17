'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAccidentSchema, FeatureKey } from '@easytrip/shared';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { PlateChip } from '@/components/plate-chip';
import { Field, FormError, Input, SelectField, Textarea } from '@/components/form';
import { Modal } from '@/components/modal';
import { MediaUrlInput } from '@/components/media-links';
import { money, shortDate } from '@/lib/format';
import { sentence } from '@/lib/status';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';

function AccidentsPageScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const settings = useSettings();
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['accidents'],
    queryFn: () => api<{ rows: any[] }>(`/accidents${query({ pageSize: 100 })}`),
  });

  const canReport = user?.role !== 'VIEWER' && user?.role !== 'ACCOUNTS';

  return (
    <div>
      <PageHeader
        title="Accidents"
        description="What happened, who was responsible, and what the repair cost."
        actions={
          canReport ? (
            <Button type="button" onClick={() => setReporting(true)}>
              Report accident
            </Button>
          ) : null
        }
      />

      <DataTable
        loading={isLoading}
        rows={data?.rows ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/incidents/accidents/${row.id}`)}
        columns={[
          { key: 'reference', header: 'Reference', render: (row) => <span className="tabular">{row.reference}</span> },
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (row) => <PlateChip registration={row.vehicle.registration} size="sm" />,
          },
          { key: 'rider', header: 'Rider', render: (row) => row.rider?.fullName ?? '' },
          { key: 'date', header: 'Date', render: (row) => shortDate(row.occurredAt) },
          { key: 'location', header: 'Location', render: (row) => row.location },
          { key: 'responsibility', header: 'Responsibility', render: (row) => sentence(row.responsibility) },
          { key: 'status', header: 'Status', render: (row) => sentence(row.status) },
          {
            key: 'cost',
            header: 'Repair',
            numeric: true,
            render: (row) => money(row.actualRepairCost ?? row.estimatedRepairCost, settings.currencySymbol),
          },
        ]}
      />

      {reporting ? (
        <ReportAccidentModal
          onClose={() => setReporting(false)}
          onSaved={() => {
            setReporting(false);
            client.invalidateQueries({ queryKey: ['accidents'] });
          }}
        />
      ) : null}
    </div>
  );
}

function ReportAccidentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'picker'],
    queryFn: () => api<{ rows: any[] }>(`/vehicles${query({ pageSize: 200 })}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/accidents', { method: 'POST', body }),
    onSuccess: () => {
      toast.confirm('Accident reported. Set responsibility once it is clear.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      wide
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Report accident"
      description="File this from the roadside. Responsibility can be decided later."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = Object.fromEntries(new FormData(event.currentTarget).entries());
          const parsed = createAccidentSchema.safeParse({
            vehicleId: form.vehicleId,
            occurredAt: form.occurredAt,
            location: form.location,
            description: form.description,
            riderStatement: form.riderStatement || null,
            estimatedRepairCost: form.estimatedRepairCost ? Number(form.estimatedRepairCost) : null,
            thirdParty: form.thirdPartyName
              ? { name: String(form.thirdPartyName), contact: String(form.thirdPartyContact ?? '') }
              : null,
            mediaUrls,
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vehicle">
            <SelectField name="vehicleId" required defaultValue="">
              <option value="">Choose a vehicle</option>
              {(vehicles?.rows ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration}  {vehicle.make} {vehicle.model}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="When">
            <Input name="occurredAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
          </Field>
          <Field label="Where" className="sm:col-span-2">
            <Input name="location" required placeholder="Ferozepur Road roundabout" />
          </Field>
          <Field label="What happened" className="sm:col-span-2">
            <Textarea name="description" required />
          </Field>
          <Field label="Rider statement" className="sm:col-span-2">
            <Textarea name="riderStatement" />
          </Field>
          <Field label="Third party name">
            <Input name="thirdPartyName" />
          </Field>
          <Field label="Third party contact">
            <Input name="thirdPartyContact" />
          </Field>
          <Field label="Estimated repair cost">
            <Input name="estimatedRepairCost" type="number" />
          </Field>
        </div>
        <MediaUrlInput urls={mediaUrls} onChange={setMediaUrls} label="Photos and videos of the scene" />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Reporting…' : 'Report accident'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccidentsPage() {
  return (
    <FeatureGate feature={FeatureKey.INCIDENTS}>
      <AccidentsPageScreen />
    </FeatureGate>
  );
}
