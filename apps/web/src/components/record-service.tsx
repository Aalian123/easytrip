'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MaintenanceType, createMaintenanceSchema } from '@easytrip/shared';
import { api, query } from '@/lib/api';
import { Field, FormError, Input, SelectField, Textarea, readEditForm } from '@/components/form';
import { Modal } from '@/components/modal';
import { useToast } from '@/components/toast';
import { useSettings } from '@/lib/settings-context';
import { sentence } from '@/lib/status';
import { Button } from '@/components/ui/button';

interface VehicleOption {
  id: string;
  registration: string;
  make: string;
  model: string;
  currentMileage: number;
  oilChangeIntervalKm: number | null;
}

/**
 * The one way to record work on a vehicle, engine oil included. Choosing
 * engine oil swaps "next service" for the oil interval, because the next oil
 * change is worked out from distance.
 */
export function RecordServiceModal({
  vehicleId,
  type = MaintenanceType.GENERAL_SERVICE,
  onClose,
  onSaved,
}: {
  vehicleId?: string;
  type?: MaintenanceType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const settings = useSettings();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [chosenType, setChosenType] = useState<string>(type);
  const [chosenVehicle, setChosenVehicle] = useState(vehicleId ?? '');
  const isOil = chosenType === MaintenanceType.ENGINE_OIL;

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'picker'],
    queryFn: () => api<{ rows: VehicleOption[] }>(`/vehicles${query({ pageSize: 200 })}`),
  });
  const vehicle = vehicles?.rows.find((row) => row.id === chosenVehicle);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/maintenance', { method: 'POST', body }),
    onSuccess: () => {
      toast.confirm(isOil ? 'Oil change recorded. The next one is due by distance.' : 'Service recorded.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={isOil ? 'Record oil change' : 'Record service'}
      description="Service records are permanent. They are added, never edited."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const parsed = createMaintenanceSchema.safeParse({ ...readEditForm(event.currentTarget), mediaUrls: [] });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vehicle">
            <SelectField
              name="vehicleId"
              required
              value={chosenVehicle}
              onChange={(event) => setChosenVehicle(event.target.value)}
              disabled={Boolean(vehicleId)}
            >
              <option value="">Choose a vehicle</option>
              {(vehicles?.rows ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {`${row.registration}  ${row.make} ${row.model}`}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Work done">
            <SelectField name="type" value={chosenType} onChange={(event) => setChosenType(event.target.value)}>
              {Object.values(MaintenanceType).map((value) => (
                <option key={value} value={value}>
                  {sentence(value)}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Date">
            <Input name="performedAt" type="date" defaultValue={new Date().toLocaleDateString('en-CA')} />
          </Field>
          <Field label="Mileage">
            <Input
              key={vehicle?.id ?? 'none'}
              name="mileage"
              type="number"
              min={0}
              required
              defaultValue={vehicle?.currentMileage ?? ''}
            />
          </Field>
          <Field label="Provider">
            <Input name="serviceProvider" />
          </Field>
          <Field label={`Cost (${settings.currencySymbol})`}>
            <Input name="cost" type="number" min={0} step="0.01" />
          </Field>
          {isOil ? (
            <Field label="Oil change interval (km)" hint="Leave blank to keep the vehicle's interval" className="sm:col-span-2">
              <Input
                key={vehicle?.id ?? 'none'}
                name="intervalKm"
                type="number"
                min={100}
                defaultValue={vehicle?.oilChangeIntervalKm ?? ''}
              />
            </Field>
          ) : (
            <>
              <Field label="Next service (date)">
                <Input name="nextServiceDate" type="date" />
              </Field>
              <Field label="Next service (km)">
                <Input name="nextServiceMileage" type="number" min={0} />
              </Field>
              <Field label="Parts replaced" className="sm:col-span-2">
                <Input name="partsReplaced" />
              </Field>
            </>
          )}
          <Field label="Notes" className="sm:col-span-2">
            <Textarea name="description" />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : isOil ? 'Record oil change' : 'Record service'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
