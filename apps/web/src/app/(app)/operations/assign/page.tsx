'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Checklist, FeatureKey } from '@easytrip/shared';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Field, FormError, Input, SelectField } from '@/components/form';
import { FuelSelect, InspectionChecklist, emptyChecklist } from '@/components/inspection-checklist';
import { MediaUrlInput } from '@/components/media-links';
import { PlateChip } from '@/components/plate-chip';
import { km, money } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';

interface VehicleOption {
  id: string;
  registration: string;
  make: string;
  model: string;
  status: string;
  currentMileage: number;
}

interface RiderOption {
  id: string;
  fullName: string;
  status: string;
  currentAssignment: { id: string } | null;
}

interface CardOption {
  id: string;
  cardNumber: string;
  provider: string;
  status: string;
}

/**
 * Handover in one pass: who takes what, the condition it left in, and the
 * evidence. The inspection is submitted with the assignment so the return has
 * something to be compared against.
 */
function AssignForm() {
  const router = useRouter();
  const params = useSearchParams();
  const settings = useSettings();
  const toast = useToast();

  const [vehicleId, setVehicleId] = useState(params.get('vehicleId') ?? '');
  const [riderId, setRiderId] = useState('');
  const [fuelCardId, setFuelCardId] = useState('');
  const [startMileage, setStartMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState<number | null>(8);
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<Checklist>(emptyChecklist());
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: vehicles } = useQuery({
    queryKey: ['assignable-vehicles'],
    queryFn: () => api<{ rows: VehicleOption[] }>(`/vehicles${query({ status: 'AVAILABLE', pageSize: 200 })}`),
  });
  const { data: riders } = useQuery({
    queryKey: ['assignable-riders'],
    queryFn: () => api<{ rows: RiderOption[] }>(`/riders${query({ status: 'ACTIVE', pageSize: 200 })}`),
  });
  const { data: cards } = useQuery({
    queryKey: ['assignable-cards'],
    queryFn: () => api<{ rows: CardOption[] }>(`/fuel/cards${query({ status: 'AVAILABLE', pageSize: 200 })}`),
  });

  const vehicle = useMemo(
    () => vehicles?.rows.find((row) => row.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  const { data: vehicleDetail } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => api<any>(`/vehicles/${vehicleId}`),
    enabled: Boolean(vehicleId),
  });

  const assign = useMutation({
    mutationFn: async () => {
      const assignment = await api<{ id: string }>('/assignments', {
        method: 'POST',
        body: {
          vehicleId,
          riderId,
          startMileage: Number(startMileage || vehicle?.currentMileage || 0),
          startFuelLevel: fuelLevel,
          fuelCardId: fuelCardId || null,
          expectedReturnAt: expectedReturnAt || null,
          notes: notes || null,
        },
      });

      await api(`/assignments/${assignment.id}/inspections`, {
        method: 'POST',
        body: {
          type: 'HANDOVER',
          mileage: Number(startMileage || vehicle?.currentMileage || 0),
          fuelLevel,
          checklist,
          mediaUrls,
        },
      });

      return assignment;
    },
    onSuccess: (assignment) => {
      toast.confirm('Vehicle assigned. The handover inspection is saved with it.');
      router.push(`/operations/assignments/${assignment.id}`);
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const availableRiders = (riders?.rows ?? []).filter((rider) => !rider.currentAssignment);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Assign a vehicle"
        description="Record who is taking the vehicle and the condition it leaves in."
      />

      <form
        className="space-y-6 pb-24"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!vehicleId || !riderId) {
            setError('Choose a vehicle and a rider');
            return;
          }
          assign.mutate();
        }}
      >
        <section className="panel space-y-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vehicle">
              <SelectField
                value={vehicleId}
                onChange={(event) => {
                  setVehicleId(event.target.value);
                  const next = vehicles?.rows.find((row) => row.id === event.target.value);
                  if (next) setStartMileage(String(next.currentMileage));
                }}
              >
                <option value="">Choose an available vehicle</option>
                {(vehicles?.rows ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.registration}  {option.make} {option.model}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Rider" hint="Riders already holding a vehicle are not listed">
              <SelectField value={riderId} onChange={(event) => setRiderId(event.target.value)}>
                <option value="">Choose a rider</option>
                {availableRiders.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.fullName}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Starting mileage">
              <Input
                type="number"
                value={startMileage}
                onChange={(event) => setStartMileage(event.target.value)}
                placeholder={vehicle ? String(vehicle.currentMileage) : '0'}
              />
            </Field>
            <Field label="Due back">
              <Input
                type="date"
                value={expectedReturnAt}
                onChange={(event) => setExpectedReturnAt(event.target.value)}
              />
            </Field>
            <Field label="Fuel card" hint="Expired or blocked cards cannot be issued">
              <SelectField value={fuelCardId} onChange={(event) => setFuelCardId(event.target.value)}>
                <option value="">No card</option>
                {(cards?.rows ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.cardNumber}  {option.provider}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Notes">
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="City route" />
            </Field>
          </div>

          {vehicleDetail?.currentRate ? (
            <p className="text-xs text-muted">
              Billed at {money(vehicleDetail.currentRate.dailyRate, settings.currencySymbol)} a day
              {vehicleDetail.currentRate.weeklyRate
                ? `, ${money(vehicleDetail.currentRate.weeklyRate, settings.currencySymbol)} a week`
                : ''}
              . Current mileage {km(vehicleDetail.currentMileage)}.
            </p>
          ) : vehicleId ? (
            <p className="text-xs text-status-maintenance">
              This vehicle has no rate set, so the rental will bill at zero.{' '}
              <Link href={`/fleet/${vehicleId}`} className="font-semibold underline">
                Set its rate
              </Link>
              .
            </p>
          ) : null}
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Handover inspection</h2>
            {vehicle ? <PlateChip registration={vehicle.registration} status="AVAILABLE" size="sm" /> : null}
          </div>
          <p className="mb-3 max-w-prose text-sm text-muted">
            Record the condition now. Once submitted this cannot be edited. It is what the return is
            compared against.
          </p>
          <div className="space-y-4">
            <FuelSelect value={fuelLevel} onChange={setFuelLevel} label="Fuel level at handover" />
            <InspectionChecklist value={checklist} onChange={setChecklist} />
            <MediaUrlInput urls={mediaUrls} onChange={setMediaUrls} />
          </div>
        </section>

        <FormError message={error} />

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 lg:static lg:border-0 lg:bg-transparent lg:px-0">
          <p className="text-xs text-muted">
            {vehicle ? `${vehicle.registration} · ` : ''}
            {mediaUrls.length} photo link{mediaUrls.length === 1 ? '' : 's'}
          </p>
          <Button type="submit" disabled={assign.isPending}>
            {assign.isPending ? 'Assigning…' : 'Assign vehicle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AssignPageScreen() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <AssignForm />
    </Suspense>
  );
}

export default function AssignPage() {
  return (
    <FeatureGate feature={FeatureKey.ASSIGNMENTS}>
      <AssignPageScreen />
    </FeatureGate>
  );
}
