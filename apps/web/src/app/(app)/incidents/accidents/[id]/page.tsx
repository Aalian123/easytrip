'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlateChip } from '@/components/plate-chip';
import { PageHeader } from '@/components/page-header';
import { Fact, Facts } from '@/components/facts';
import { Modal } from '@/components/modal';
import { StatusChip } from '@/components/status-chip';
import { MediaLinkList } from '@/components/media-links';
import { DeleteButton } from '@/components/delete-dialog';
import { Field, FormError, Input, SelectField, Textarea } from '@/components/form';
import { dateTime, money, shortDate } from '@/lib/format';
import { sentence } from '@/lib/status';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { AccidentStatus, FeatureKey, ResponsibleParty } from '@easytrip/shared';
import { Button } from '@/components/ui/button';

const OPEN_TONE = { hex: '#D0342C', tint: '#FBE9E8' };
const CLOSED_TONE = { hex: '#5F7288', tint: '#EEF2F7' };

function AccidentPageScreen() {
  const params = useParams<{ id: string }>();
  const settings = useSettings();
  const { user } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const { data: accident } = useQuery({
    queryKey: ['accident', params.id],
    queryFn: () => api<any>(`/accidents/${params.id}`),
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/accidents/${params.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      setUpdating(false);
      client.invalidateQueries({ queryKey: ['accident', params.id] });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  if (!accident) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        crumbs={[{ href: '/incidents/accidents', label: 'Accidents' }, { label: accident.reference }]}
        title={accident.reference}
        status={
          <>
            <StatusChip
              style={{
                label: sentence(accident.status),
                ...(['RESOLVED', 'CLOSED'].includes(accident.status) ? CLOSED_TONE : OPEN_TONE),
              }}
            />
            <PlateChip
              registration={accident.vehicle.registration}
              status={accident.vehicle.status}
              href={`/fleet/${accident.vehicle.id}`}
            />
            {accident.rider ? (
              <Link href={`/riders/${accident.rider.id}`} className="text-sm text-sky hover:underline">
                {accident.rider.fullName}
              </Link>
            ) : null}
          </>
        }
        actions={
          <>
            {canManageFleet(user?.role) ? (
              <Button type="button" variant="outline" onClick={() => setUpdating(true)}>
                Update case
              </Button>
            ) : null}
            <DeleteButton kind="accident" id={accident.id} onDeleted={() => router.push('/incidents/accidents')} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="panel p-3">
            <p className="text-xs text-muted">
              {dateTime(accident.occurredAt)} · {accident.location}
            </p>
            <p className="mt-2 max-w-prose text-sm">{accident.description}</p>
            {accident.riderStatement ? (
              <>
                <p className="mt-3 text-xs font-medium text-muted">Rider statement</p>
                <p className="max-w-prose text-sm">{accident.riderStatement}</p>
              </>
            ) : null}
            {accident.thirdParty ? (
              <>
                <p className="mt-3 text-xs font-medium text-muted">Third party</p>
                <p className="text-sm">
                  {accident.thirdParty.name}
                  {accident.thirdParty.contact ? ` · ${accident.thirdParty.contact}` : ''}
                </p>
              </>
            ) : null}
          </div>

          <section>
            <h2 className="mb-2 text-base font-semibold">Evidence</h2>
            <MediaLinkList links={accident.mediaLinks ?? []} />
          </section>

          {accident.damages?.length ? (
            <section>
              <h2 className="mb-2 text-base font-semibold">Damage from this accident</h2>
              <div className="panel divide-y divide-line">
                {accident.damages.map((damage: any) => (
                  <div key={damage.id} className="px-3 py-2 text-sm">
                    {sentence(damage.severity)} {sentence(damage.category).toLowerCase()}: {damage.description}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Facts>
            <Fact label="Responsibility" value={sentence(accident.responsibility)} />
            <Fact
              label="Estimated repair"
              value={accident.estimatedRepairCost ? money(accident.estimatedRepairCost, settings.currencySymbol) : null}
              tabular
              hideEmpty
            />
            <Fact
              label="Actual repair"
              value={accident.actualRepairCost ? money(accident.actualRepairCost, settings.currencySymbol) : null}
              tabular
              hideEmpty
            />
            <Fact label="Resolved" value={accident.resolvedAt ? shortDate(accident.resolvedAt) : null} tabular hideEmpty />
            <Fact label="Comments" value={accident.managementComments} hideEmpty />
          </Facts>
        </aside>
      </div>

      {updating ? (
        <Modal
          open
          onOpenChange={(next) => (next ? undefined : setUpdating(false))}
          title="Update case"
          description="Responsibility is recorded separately from the report itself."
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const form = new FormData(event.currentTarget);
              update.mutate({
                status: form.get('status'),
                responsibility: form.get('responsibility'),
                actualRepairCost: form.get('actualRepairCost') ? Number(form.get('actualRepairCost')) : undefined,
                managementComments: form.get('managementComments') || undefined,
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <SelectField name="status" defaultValue={accident.status}>
                  {Object.values(AccidentStatus).map((status) => (
                    <option key={status} value={status}>
                      {sentence(status)}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label="Responsibility">
                <SelectField name="responsibility" defaultValue={accident.responsibility}>
                  {Object.values(ResponsibleParty).map((value) => (
                    <option key={value} value={value}>
                      {sentence(value)}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label={`Actual repair cost (${settings.currencySymbol})`} className="sm:col-span-2">
                <Input name="actualRepairCost" type="number" min={0} defaultValue={accident.actualRepairCost ?? ''} />
              </Field>
              <Field label="Comments" className="sm:col-span-2">
                <Textarea name="managementComments" defaultValue={accident.managementComments ?? ''} />
              </Field>
            </div>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUpdating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export default function AccidentPage() {
  return (
    <FeatureGate feature={FeatureKey.INCIDENTS}>
      <AccidentPageScreen />
    </FeatureGate>
  );
}
