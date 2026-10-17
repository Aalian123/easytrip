'use client';

import { LicenceClass, PlateType } from '@easytrip/shared';
import { Field, Input, SelectField, Textarea } from '@/components/form';
import { LICENCE_CLASS_LABEL, PLATE_TYPE_LABEL } from '@/lib/status';
import { dayInput } from '@/lib/format';

export interface VehicleFieldValues {
  registration: string;
  category: string;
  plateType: PlateType;
  licenceClass: LicenceClass;
  make: string;
  model: string;
  year: number;
  color: string;
  engineNumber: string | null;
  chassisNumber: string | null;
  purchaseDate: string | null;
  oilChangeIntervalKm: number | null;
  notes: string | null;
}

/**
 * The one set of vehicle inputs, used by both "Add vehicle" and "Edit vehicle"
 * so the two forms cannot drift apart. Mileage is only asked for when adding:
 * after that it comes from handovers and servicing.
 */
export function VehicleFields({ vehicle }: { vehicle?: VehicleFieldValues }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Registration">
        <Input name="registration" required placeholder="FLT-1042" defaultValue={vehicle?.registration} />
      </Field>
      <Field label="Category">
        <Input name="category" required placeholder="Sedan" defaultValue={vehicle?.category} />
      </Field>
      <Field label="Plate">
        <SelectField name="plateType" required defaultValue={vehicle?.plateType ?? PlateType.WHITE}>
          {Object.values(PlateType).map((value) => (
            <option key={value} value={value}>
              {PLATE_TYPE_LABEL[value]}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Licence" hint="The licence a rider needs to drive it">
        <SelectField name="licenceClass" required defaultValue={vehicle?.licenceClass ?? LicenceClass.PRIVATE}>
          {Object.values(LicenceClass).map((value) => (
            <option key={value} value={value}>
              {LICENCE_CLASS_LABEL[value]}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Make">
        <Input name="make" required defaultValue={vehicle?.make} />
      </Field>
      <Field label="Model">
        <Input name="model" required defaultValue={vehicle?.model} />
      </Field>
      <Field label="Year">
        <Input name="year" type="number" required defaultValue={vehicle?.year ?? new Date().getFullYear()} />
      </Field>
      <Field label="Colour">
        <Input name="color" required defaultValue={vehicle?.color} />
      </Field>
      {vehicle ? null : (
        <Field label="Current mileage">
          <Input name="currentMileage" type="number" min={0} defaultValue={0} />
        </Field>
      )}
      <Field label="Oil change interval (km)" hint="Leave blank to use the fleet default">
        <Input name="oilChangeIntervalKm" type="number" min={0} defaultValue={vehicle?.oilChangeIntervalKm ?? ''} />
      </Field>
      <Field label="Engine number">
        <Input name="engineNumber" defaultValue={vehicle?.engineNumber ?? ''} />
      </Field>
      <Field label="Chassis number">
        <Input name="chassisNumber" defaultValue={vehicle?.chassisNumber ?? ''} />
      </Field>
      <Field label="Purchased">
        <Input name="purchaseDate" type="date" defaultValue={dayInput(vehicle?.purchaseDate)} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={vehicle?.notes ?? ''} />
      </Field>
    </div>
  );
}
