'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RiderStatus, updateRiderSchema } from '@easytrip/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { PlateChip } from '@/components/plate-chip';
import { StatusChip } from '@/components/status-chip';
import { PageHeader, SectionTitle } from '@/components/page-header';
import { DocumentPanel } from '@/components/document-panel';
import { RiderFields } from '@/components/rider-fields';
import { Fact, Facts } from '@/components/facts';
import { Field, FormError, SelectField, Textarea, readEditForm } from '@/components/form';
import { Modal } from '@/components/modal';
import { DeleteButton } from '@/components/delete-dialog';
import { useToast } from '@/components/toast';
import { riderStatus } from '@/lib/status';
import { dateTime, km, money, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface RiderDetail {
  id: string;
  fullName: string;
  nationalId: string;
  contactNumber: string;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  licenceNumber: string | null;
  licenceIssuedAt: string | null;
  licenceExpiresAt: string | null;
  employmentStatus: string | null;
  notes: string | null;
  status: string;
  currentAssignment: {
    id: string;
    assignedAt: string;
    expectedReturnAt: string | null;
    vehicle: { id: string; registration: string; make: string; model: string; status: string };
  } | null;
  currentFuelCard: { id: string; cardNumber: string; provider: string } | null;
  _count: { assignments: number; accidents: number; damages: number };
}

interface RiderHistory {
  events: { id: string; type: string; summary: string; occurredAt: string }[];
  assignments: {
    id: string;
    assignedAt: string;
    returnedAt: string | null;
    startMileage: number;
    endMileage: number | null;
    status: string;
    vehicle: { id: string; registration: string; make: string; model: string };
    rentalCharge: { totalAmount: string; paymentStatus: string } | null;
  }[];
}

export default function RiderPage() {
  const params = useParams<{ id: string }>();
  const settings = useSettings();
  const { user } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const { data: rider } = useQuery({
    queryKey: ['rider', params.id],
    queryFn: () => api<RiderDetail>(`/riders/${params.id}`),
  });
  const { data: history } = useQuery({
    queryKey: ['rider-history', params.id],
    queryFn: () => api<RiderHistory>(`/riders/${params.id}/history`),
  });

  if (!rider) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-7 w-64" />
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }

  const licenceExpired = rider.licenceExpiresAt && new Date(rider.licenceExpiresAt) < new Date();

  return (
    <div>
      <PageHeader
        crumbs={[{ href: '/riders', label: 'Riders' }, { label: rider.fullName }]}
        title={rider.fullName}
        status={<StatusChip style={riderStatus(rider.status)} />}
        actions={
          canManageFleet(user?.role) ? (
            <>
              <Button type="button" variant="outline" onClick={() => setChangingStatus(true)}>
                Change status
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Edit details
              </Button>
              <DeleteButton kind="rider" id={rider.id} onDeleted={() => router.push('/riders')} />
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section>
            <SectionTitle as="h3">On the road with</SectionTitle>
            <div className="panel p-4">
              {rider.currentAssignment ? (
                <>
                  <div className="flex items-center gap-3">
                    <PlateChip
                      registration={rider.currentAssignment.vehicle.registration}
                      status={rider.currentAssignment.vehicle.status}
                      href={`/fleet/${rider.currentAssignment.vehicle.id}`}
                    />
                    <span className="truncate text-sm text-muted">
                      {rider.currentAssignment.vehicle.make} {rider.currentAssignment.vehicle.model}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
                    <div className="flex justify-between gap-3">
                      <dt>Since</dt>
                      <dd className="tabular text-ink">{dateTime(rider.currentAssignment.assignedAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Due back</dt>
                      <dd className="tabular text-ink">
                        {rider.currentAssignment.expectedReturnAt
                          ? shortDate(rider.currentAssignment.expectedReturnAt)
                          : 'Open ended'}
                      </dd>
                    </div>
                    {rider.currentFuelCard ? (
                      <div className="flex justify-between gap-3">
                        <dt>Fuel card</dt>
                        <dd className="tabular text-ink">
                          {rider.currentFuelCard.cardNumber}
                          <span className="ml-1.5 text-muted">{rider.currentFuelCard.provider}</span>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <Link
                    href={`/operations/assignments/${rider.currentAssignment.id}`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 w-full')}
                  >
                    Open assignment
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted">No vehicle assigned.</p>
              )}
            </div>
          </section>

          <section>
            <SectionTitle as="h3">Details</SectionTitle>
            <Facts>
              <Fact label={settings.nationalIdLabel} value={rider.nationalId} tabular />
              <Fact label="Phone" value={rider.contactNumber} tabular />
              <Fact label="Licence" value={rider.licenceNumber} tabular hideEmpty />
              <Fact
                label="Licence expires"
                value={rider.licenceExpiresAt ? shortDate(rider.licenceExpiresAt) : null}
                tone={licenceExpired ? 'font-semibold text-status-accident' : undefined}
                tabular
                hideEmpty
              />
              <Fact label="Employment" value={rider.employmentStatus} hideEmpty />
              <Fact label="Address" value={rider.address} hideEmpty />
              <Fact label="Notes" value={rider.notes} hideEmpty />
              <Fact
                label="Emergency"
                value={
                  rider.emergencyContactName ? (
                    <>
                      {rider.emergencyContactName}
                      {rider.emergencyContactNumber ? (
                        <span className="tabular block text-xs text-muted">{rider.emergencyContactNumber}</span>
                      ) : null}
                    </>
                  ) : null
                }
              />
            </Facts>
          </section>
        </aside>

        <Tabs defaultValue="assignments">
          <TabsList>
            {[
              ['assignments', `Assignments (${rider._count.assignments})`],
              ['history', 'History'],
              ['documents', 'Documents'],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="assignments">
            <div className="panel divide-y divide-line overflow-hidden">
              {(history?.assignments ?? []).length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted">This rider has not held a vehicle yet.</p>
              ) : (
                history!.assignments.map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/operations/assignments/${assignment.id}`}
                    className="row-link flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <PlateChip registration={assignment.vehicle.registration} size="sm" />
                      <span className="text-sm text-ink">
                        {assignment.vehicle.make} {assignment.vehicle.model}
                      </span>
                      <span className="tabular text-xs text-muted">
                        {shortDate(assignment.assignedAt)}
                        {assignment.returnedAt ? ` to ${shortDate(assignment.returnedAt)}` : ', out now'}
                      </span>
                    </span>
                    <span className="flex gap-5 text-xs text-muted">
                      <span className="tabular">
                        {assignment.endMileage != null ? km(assignment.endMileage - assignment.startMileage) : ''}
                      </span>
                      <span className="tabular w-20 text-right text-ink">
                        {assignment.rentalCharge
                          ? money(assignment.rentalCharge.totalAmount, settings.currencySymbol)
                          : ''}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="panel divide-y divide-line overflow-hidden">
              {(history?.events ?? []).length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted">Nothing has been recorded for this rider yet.</p>
              ) : null}
              {(history?.events ?? []).map((event) => (
                <div key={event.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <time className="tabular w-32 shrink-0 text-xs text-muted">{dateTime(event.occurredAt)}</time>
                  <span className="text-sm text-ink">{event.summary}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <DocumentPanel ownerType="RIDER" ownerId={rider.id} />
          </TabsContent>
        </Tabs>
      </div>

      {changingStatus ? (
        <ChangeRiderStatusModal
          riderId={rider.id}
          current={rider.status}
          onClose={() => setChangingStatus(false)}
          onSaved={() => {
            setChangingStatus(false);
            client.invalidateQueries({ queryKey: ['rider', params.id] });
            client.invalidateQueries({ queryKey: ['rider-history', params.id] });
            client.invalidateQueries({ queryKey: ['riders'] });
          }}
        />
      ) : null}

      {editing ? (
        <EditRiderModal
          rider={rider}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            client.invalidateQueries({ queryKey: ['rider', params.id] });
            client.invalidateQueries({ queryKey: ['riders'] });
          }}
        />
      ) : null}
    </div>
  );
}

const RIDER_STATUSES: RiderStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED'];

function ChangeRiderStatusModal({
  riderId,
  current,
  onClose,
  onSaved,
}: {
  riderId: string;
  current: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: { status: string; reason?: string }) =>
      api(`/riders/${riderId}/status`, { method: 'POST', body }),
    onSuccess: onSaved,
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Change rider status"
      description="The change is recorded on the rider's history."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = new FormData(event.currentTarget);
          save.mutate({
            status: String(form.get('status')),
            reason: String(form.get('reason') || ''),
          });
        }}
      >
        <Field label="New status">
          <SelectField name="status" defaultValue={current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}>
            {RIDER_STATUSES.filter((status) => status !== current).map((status) => (
              <option key={status} value={status}>
                {riderStatus(status).label}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Reason" hint="Shown on the rider's history next to the change">
          <Textarea name="reason" placeholder="Licence under review" />
        </Field>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Change status'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditRiderModal({
  rider,
  onClose,
  onSaved,
}: {
  rider: RiderDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/riders/${rider.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.confirm('Rider details saved.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Edit rider"
      description="To suspend or blacklist a rider, change their status instead. That is kept on their history."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const parsed = updateRiderSchema.safeParse(readEditForm(event.currentTarget));
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <RiderFields rider={rider} />
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
