'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ASSIGNMENT_OWNED_STATUSES,
  FeatureKey,
  LicenceClass,
  PlateType,
  VehicleStatus,
  rentalRateSchema,
  updateVehicleSchema,
} from '@easytrip/shared';
import { useFeatures } from '@/lib/features-context';
import { api, query } from '@/lib/api';
import { PlateChip } from '@/components/plate-chip';
import { HeaderMeta, PageHeader, SectionTitle } from '@/components/page-header';
import { StatusChip } from '@/components/status-chip';
import { Timeline, TimelineEvent } from '@/components/timeline';
import { MediaLinkList, MediaLinkRow } from '@/components/media-links';
import { DocumentPanel } from '@/components/document-panel';
import { Avatar, Fact, Facts } from '@/components/facts';
import { Field, FormError, Input, SelectField, Textarea, readEditForm } from '@/components/form';
import { Modal } from '@/components/modal';
import { DeleteButton } from '@/components/delete-dialog';
import { useToast } from '@/components/toast';
import { LICENCE_CLASS_LABEL, PLATE_TYPE_LABEL, oilReading, sentence, vehicleStatus } from '@/lib/status';
import { dateTime, km, money, shortDate } from '@/lib/format';
import { VehicleFields } from '@/components/vehicle-fields';
import { RecordServiceModal } from '@/components/record-service';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, canManageMoney, useAuth } from '@/lib/auth-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface VehicleDetail {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  color: string;
  category: string;
  plateType: PlateType;
  licenceClass: LicenceClass;
  status: VehicleStatus;
  currentMileage: number;
  engineNumber: string | null;
  chassisNumber: string | null;
  purchaseDate: string | null;
  lastOilChangeDate: string | null;
  lastOilChangeMileage: number | null;
  oilChangeIntervalKm: number | null;
  oil: { status: string; nextChangeMileage: number | null; remainingKm: number | null };
  currentAssignment: {
    id: string;
    assignedAt: string;
    expectedReturnAt: string | null;
    rider: { id: string; fullName: string; contactNumber: string };
    fuelCard: { id: string; cardNumber: string } | null;
  } | null;
  notes: string | null;
  currentRate: RentalRate | null;
  upcomingRate: RentalRate | null;
  rentalRates: RentalRate[];
  _count: { assignments: number; accidents: number; damages: number; maintenance: number };
}

interface RentalRate {
  id: string;
  dailyRate: string;
  weeklyRate: string | null;
  monthlyRate: string | null;
  securityDeposit: string | null;
  lateReturnFeePerDay: string | null;
  effectiveFrom: string;
}

/** Everything but "on the road", which only a handover sets. */
const MANUAL_STATUSES = Object.values(VehicleStatus).filter((status) => !ASSIGNMENT_OWNED_STATUSES.includes(status));

export default function VehiclePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const settings = useSettings();
  const { user } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const [changingStatus, setChangingStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [settingRate, setSettingRate] = useState(false);
  const [recordingService, setRecordingService] = useState(false);
  const { enabled } = useFeatures();
  const canSetRate = canManageFleet(user?.role) || canManageMoney(user?.role);

  const refresh = () => {
    client.invalidateQueries({ queryKey: ['vehicle', id] });
    client.invalidateQueries({ queryKey: ['vehicle-timeline', id] });
    client.invalidateQueries({ queryKey: ['vehicles'] });
    client.invalidateQueries({ queryKey: ['vehicle-maintenance', id] });
  };

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api<VehicleDetail>(`/vehicles/${id}`),
  });
  const { data: timeline } = useQuery({
    queryKey: ['vehicle-timeline', id],
    queryFn: () => api<TimelineEvent[]>(`/vehicles/${id}/timeline`),
  });
  const { data: media } = useQuery({
    queryKey: ['vehicle-media', id],
    queryFn: () => api<MediaLinkRow[]>(`/media${query({ vehicleId: id })}`),
  });
  const { data: maintenance } = useQuery({
    queryKey: ['vehicle-maintenance', id],
    queryFn: () => api<{ rows: any[] }>(`/maintenance${query({ vehicleId: id, pageSize: 50 })}`),
  });
  const { data: damages } = useQuery({
    queryKey: ['vehicle-damages', id],
    queryFn: () => api<{ rows: any[] }>(`/damages${query({ vehicleId: id, pageSize: 50 })}`),
  });
  const { data: accidents } = useQuery({
    queryKey: ['vehicle-accidents', id],
    queryFn: () => api<{ rows: any[] }>(`/accidents${query({ vehicleId: id, pageSize: 50 })}`),
  });

  if (!vehicle) {
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

  const oil = oilReading(vehicle.oil);

  return (
    <div>
      <PageHeader
        crumbs={[{ href: '/fleet', label: 'Fleet' }, { label: vehicle.registration }]}
        title={`${vehicle.make} ${vehicle.model}`}
        status={
          <>
            <PlateChip registration={vehicle.registration} status={vehicle.status} plateType={vehicle.plateType} />
            <StatusChip style={vehicleStatus(vehicle.status)} />
            <span className="text-sm text-muted">
              {vehicle.year} {vehicle.color} {vehicle.category}
            </span>
          </>
        }
        meta={
          <>
            <HeaderMeta label="Mileage" value={km(vehicle.currentMileage)} />
            <HeaderMeta label="Oil" value={<span className={oil.tone}>{oil.text}</span>} />
          </>
        }
        actions={
          canManageFleet(user?.role) ? (
            <>
              {vehicle.status === 'AVAILABLE' ? (
                <Link href={`/operations/assign?vehicleId=${vehicle.id}`} className={cn(buttonVariants())}>
                  Assign a vehicle
                </Link>
              ) : null}
              {vehicle.currentAssignment ? (
                <Link
                  href={`/operations/assignments/${vehicle.currentAssignment.id}`}
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  Open assignment
                </Link>
              ) : null}
              {vehicle.currentAssignment ? null : (
                <Button type="button" variant="outline" onClick={() => setChangingStatus(true)}>
                  Change status
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Edit details
              </Button>
              <DeleteButton kind="vehicle" id={vehicle.id} onDeleted={() => router.push('/fleet')} />
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-6">
          {vehicle.currentAssignment ? (
            <section>
              <SectionTitle as="h3">On the road with</SectionTitle>
              <div className="panel p-4">
                <Link
                  href={`/riders/${vehicle.currentAssignment.rider.id}`}
                  className="group flex items-center gap-3"
                >
                  <Avatar name={vehicle.currentAssignment.rider.fullName} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-navy group-hover:underline">
                      {vehicle.currentAssignment.rider.fullName}
                    </span>
                    <span className="tabular block text-xs text-muted">
                      {vehicle.currentAssignment.rider.contactNumber}
                    </span>
                  </span>
                </Link>
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
                  <div className="flex justify-between gap-3">
                    <dt>Since</dt>
                    <dd className="tabular text-ink">{dateTime(vehicle.currentAssignment.assignedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Due back</dt>
                    <dd className="tabular text-ink">
                      {vehicle.currentAssignment.expectedReturnAt
                        ? shortDate(vehicle.currentAssignment.expectedReturnAt)
                        : 'Open ended'}
                    </dd>
                  </div>
                  {vehicle.currentAssignment.fuelCard ? (
                    <div className="flex justify-between gap-3">
                      <dt>Fuel card</dt>
                      <dd className="tabular text-ink">{vehicle.currentAssignment.fuelCard.cardNumber}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle as="h3">Details</SectionTitle>
            <Facts>
              <Fact label="Plate" value={PLATE_TYPE_LABEL[vehicle.plateType]} />
              <Fact label="Licence" value={LICENCE_CLASS_LABEL[vehicle.licenceClass]} />
              <Fact
                label="Last oil change"
                value={
                  vehicle.lastOilChangeMileage != null
                    ? `${km(vehicle.lastOilChangeMileage)}${vehicle.lastOilChangeDate ? `, ${shortDate(vehicle.lastOilChangeDate)}` : ''}`
                    : null
                }
                tabular
                hideEmpty
              />
              <Fact label="Oil interval" value={vehicle.oilChangeIntervalKm ? km(vehicle.oilChangeIntervalKm) : 'Fleet default'} tabular />
              <Fact label="Engine no." value={vehicle.engineNumber} tabular hideEmpty />
              <Fact label="Chassis no." value={vehicle.chassisNumber} tabular hideEmpty />
              <Fact label="Purchased" value={vehicle.purchaseDate ? shortDate(vehicle.purchaseDate) : null} tabular hideEmpty />
              <Fact label="Notes" value={vehicle.notes} hideEmpty />
            </Facts>
          </section>

          <section>
            <SectionTitle
              as="h3"
              aside={
                canSetRate && vehicle.currentRate ? (
                  <Button type="button" variant="link" size="sm" onClick={() => setSettingRate(true)}>
                    Change rate
                  </Button>
                ) : null
              }
            >
              Rental rate
            </SectionTitle>
            {vehicle.currentRate ? (
              <Facts>
                <Fact label="Daily" value={money(vehicle.currentRate.dailyRate, settings.currencySymbol)} tabular />
                <Fact label="Weekly" value={vehicle.currentRate.weeklyRate ? money(vehicle.currentRate.weeklyRate, settings.currencySymbol) : null} tabular hideEmpty />
                <Fact label="Monthly" value={vehicle.currentRate.monthlyRate ? money(vehicle.currentRate.monthlyRate, settings.currencySymbol) : null} tabular hideEmpty />
                <Fact label="Deposit" value={vehicle.currentRate.securityDeposit ? money(vehicle.currentRate.securityDeposit, settings.currencySymbol) : null} tabular hideEmpty />
                <Fact label="Late fee / day" value={vehicle.currentRate.lateReturnFeePerDay ? money(vehicle.currentRate.lateReturnFeePerDay, settings.currencySymbol) : null} tabular hideEmpty />
              </Facts>
            ) : (
              <div className="panel px-4 py-4 text-sm text-muted">
                <p>No rate in force. Vehicles assigned without one are billed at zero.</p>
                {canSetRate ? (
                  <Button type="button" size="sm" className="mt-3 w-full" onClick={() => setSettingRate(true)}>
                    Set rate
                  </Button>
                ) : null}
              </div>
            )}
            {vehicle.currentRate ? (
              <p className="mt-2 text-xs text-muted">
                In force since <span className="tabular">{shortDate(vehicle.currentRate.effectiveFrom)}</span>.
              </p>
            ) : null}
            {vehicle.upcomingRate ? (
              <p className="mt-2 text-xs text-muted">
                <span className="tabular text-ink">
                  {money(vehicle.upcomingRate.dailyRate, settings.currencySymbol)} a day
                </span>{' '}
                from <span className="tabular">{shortDate(vehicle.upcomingRate.effectiveFrom)}</span>.
              </p>
            ) : null}
            {vehicle.rentalRates.length > 1 ? (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted hover:text-navy">Rate history</summary>
                <ul className="panel mt-2 divide-y divide-line overflow-hidden">
                  {vehicle.rentalRates.map((rate) => (
                    <li key={rate.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                      <span className="tabular text-muted">
                        {shortDate(rate.effectiveFrom)}
                        {rate.id === vehicle.currentRate?.id ? (
                          <span className="ml-1.5 font-semibold text-status-available">in force</span>
                        ) : null}
                      </span>
                      <span className="tabular text-ink">
                        {money(rate.dailyRate, settings.currencySymbol)} / day
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        </aside>

        <Tabs defaultValue="history">
          <TabsList>
            {[
              ['history', 'History'],
              ['maintenance', `Service history (${vehicle._count.maintenance})`],
              ['incidents', `Incidents (${vehicle._count.accidents + vehicle._count.damages})`],
              ['documents', 'Documents'],
              ['media', 'Photos and videos'],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="history">
            <div className="pt-1">
              <Timeline events={timeline ?? []} />
            </div>
          </TabsContent>

          <TabsContent value="maintenance">
            {canManageFleet(user?.role) && enabled[FeatureKey.MAINTENANCE] ? (
              <div className="mb-3 flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setRecordingService(true)}>
                  Record service
                </Button>
              </div>
            ) : null}
            <div className="panel divide-y divide-line overflow-hidden">
              {(maintenance?.rows ?? []).length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted">No service recorded yet.</p>
              ) : (
                maintenance!.rows.map((record) => (
                  <div key={record.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                    <span className="text-sm">
                      <span className="font-medium text-ink">{sentence(record.type)}</span>
                      {record.serviceProvider ? (
                        <span className="ml-2 text-xs text-muted">{record.serviceProvider}</span>
                      ) : null}
                    </span>
                    <span className="flex gap-5 text-xs text-muted">
                      <span className="tabular">{km(record.mileage)}</span>
                      <span className="tabular">{shortDate(record.performedAt)}</span>
                      <span className="tabular w-20 text-right text-ink">{money(record.cost, settings.currencySymbol)}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="incidents">
            <div className="space-y-6">
              <section>
                <SectionTitle as="h3">Accidents</SectionTitle>
                <div className="panel divide-y divide-line overflow-hidden">
                  {(accidents?.rows ?? []).length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted">No accidents recorded.</p>
                  ) : (
                    accidents!.rows.map((accident) => (
                      <Link
                        key={accident.id}
                        href={`/incidents/accidents/${accident.id}`}
                        className="row-link flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
                      >
                        <span className="text-sm">
                          <span className="tabular font-medium text-ink">{accident.reference}</span>
                          <span className="ml-2 text-muted">{accident.location}</span>
                        </span>
                        <span className="text-xs text-muted">
                          {shortDate(accident.occurredAt)}, {sentence(accident.status).toLowerCase()}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </section>
              <section>
                <SectionTitle as="h3">Damage</SectionTitle>
                <div className="panel divide-y divide-line overflow-hidden">
                  {(damages?.rows ?? []).length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted">No damage recorded.</p>
                  ) : (
                    damages!.rows.map((damage) => (
                      <div key={damage.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                        <span className="text-sm">
                          <span className="font-medium text-ink">
                            {sentence(damage.severity)} {sentence(damage.category).toLowerCase()}
                          </span>
                          <span className="ml-2 text-xs text-muted">{damage.description}</span>
                        </span>
                        <span className="text-xs text-muted">
                          {shortDate(damage.detectedAt)}, {sentence(damage.repairStatus).toLowerCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <DocumentPanel ownerType="VEHICLE" ownerId={vehicle.id} />
          </TabsContent>

          <TabsContent value="media">
            <MediaLinkList links={media ?? []} />
          </TabsContent>
        </Tabs>
      </div>

      <ChangeStatusModal
        open={changingStatus}
        current={vehicle.status}
        onClose={() => setChangingStatus(false)}
        onSaved={() => {
          setChangingStatus(false);
          refresh();
        }}
        vehicleId={vehicle.id}
      />

      {editing ? (
        <EditVehicleModal
          vehicle={vehicle}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : null}

      {recordingService ? (
        <RecordServiceModal
          vehicleId={vehicle.id}
          onClose={() => setRecordingService(false)}
          onSaved={() => {
            setRecordingService(false);
            refresh();
          }}
        />
      ) : null}

      {settingRate ? (
        <RateModal
          vehicleId={vehicle.id}
          current={vehicle.upcomingRate ?? vehicle.currentRate}
          onClose={() => setSettingRate(false)}
          onSaved={() => {
            setSettingRate(false);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function EditVehicleModal({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: VehicleDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/vehicles/${vehicle.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.confirm('Vehicle details saved.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Edit vehicle"
      description="Mileage and oil readings come from handovers and servicing, so they are not edited here."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const parsed = updateVehicleSchema.safeParse(readEditForm(event.currentTarget));
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <VehicleFields vehicle={vehicle} />
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

/**
 * Rates are never edited in place: saving adds a new rate from the chosen day,
 * and every vehicle already out keeps the rate it left with.
 */
function RateModal({
  vehicleId,
  current,
  onClose,
  onSaved,
}: {
  vehicleId: string;
  current: RentalRate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const settings = useSettings();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  // The operator's own calendar day, not UTC's.
  const today = new Date().toLocaleDateString('en-CA');

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/vehicles/${vehicleId}/rates`, { method: 'POST', body }),
    onSuccess: () => {
      toast.confirm('Rental rate saved.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={current ? 'Change rental rate' : 'Set rental rate'}
      description="Saving adds a new rate from the date you choose. Vehicles already out keep the rate they left with."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const { effectiveFrom: day, ...form } = readEditForm(event.currentTarget);
          const parsed = rentalRateSchema.safeParse({
            ...form,
            // Today means now, so the rate applies to the next handover rather
            // than waiting for midnight. Any other day starts at local midnight.
            effectiveFrom: !day || day === today ? new Date() : new Date(`${day}T00:00`),
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Daily rate (${settings.currencySymbol})`}>
            <Input name="dailyRate" type="number" min={0} step="0.01" required defaultValue={current?.dailyRate ?? ''} />
          </Field>
          <Field label={`Weekly rate (${settings.currencySymbol})`} hint="Optional. Used for each full 7 days">
            <Input name="weeklyRate" type="number" min={0} step="0.01" defaultValue={current?.weeklyRate ?? ''} />
          </Field>
          <Field label={`Monthly rate (${settings.currencySymbol})`} hint="Optional. Used for each full 30 days">
            <Input name="monthlyRate" type="number" min={0} step="0.01" defaultValue={current?.monthlyRate ?? ''} />
          </Field>
          <Field label={`Security deposit (${settings.currencySymbol})`}>
            <Input name="securityDeposit" type="number" min={0} step="0.01" defaultValue={current?.securityDeposit ?? ''} />
          </Field>
          <Field label={`Late fee per day (${settings.currencySymbol})`} hint="Charged for each day past the due date">
            <Input
              name="lateReturnFeePerDay"
              type="number"
              min={0}
              step="0.01"
              defaultValue={current?.lateReturnFeePerDay ?? ''}
            />
          </Field>
          <Field label="Applies from">
            <Input name="effectiveFrom" type="date" defaultValue={today} />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Save rate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ChangeStatusModal({
  open,
  current,
  vehicleId,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: VehicleStatus;
  vehicleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: { status: string; reason?: string }) =>
      api(`/vehicles/${vehicleId}/status`, { method: 'POST', body }),
    onSuccess: onSaved,
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Change vehicle status"
      description="The change is recorded on the vehicle's permanent history."
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
          <SelectField name="status" defaultValue={current === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE'}>
            {MANUAL_STATUSES.filter((status) => status !== current).map((status) => (
              <option key={status} value={status}>
                {vehicleStatus(status).label}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Reason" hint="Shown on the timeline next to the change">
          <Textarea name="reason" placeholder="Sent for brake pad replacement" />
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
