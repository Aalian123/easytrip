'use client';

import { Field, Input, Textarea } from '@/components/form';
import { dayInput } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';

export interface RiderFieldValues {
  fullName: string;
  nationalId: string;
  contactNumber: string;
  employmentStatus: string | null;
  licenceNumber: string | null;
  licenceIssuedAt: string | null;
  licenceExpiresAt: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  notes: string | null;
}

/** The one set of rider inputs, shared by "Add rider" and "Edit rider". */
export function RiderFields({ rider }: { rider?: RiderFieldValues }) {
  const settings = useSettings();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name">
        <Input name="fullName" required defaultValue={rider?.fullName} />
      </Field>
      <Field label={settings.nationalIdLabel}>
        <Input name="nationalId" required defaultValue={rider?.nationalId} />
      </Field>
      <Field label="Phone">
        <Input name="contactNumber" required defaultValue={rider?.contactNumber} />
      </Field>
      <Field label="Employment status">
        <Input name="employmentStatus" placeholder="Full time" defaultValue={rider?.employmentStatus ?? ''} />
      </Field>
      <Field label="Licence number">
        <Input name="licenceNumber" defaultValue={rider?.licenceNumber ?? ''} />
      </Field>
      <Field label="Licence issued">
        <Input name="licenceIssuedAt" type="date" defaultValue={dayInput(rider?.licenceIssuedAt)} />
      </Field>
      <Field label="Licence expires" hint="Drives the renewal alert">
        <Input name="licenceExpiresAt" type="date" defaultValue={dayInput(rider?.licenceExpiresAt)} />
      </Field>
      <Field label="Address">
        <Input name="address" defaultValue={rider?.address ?? ''} />
      </Field>
      <Field label="Emergency contact">
        <Input name="emergencyContactName" defaultValue={rider?.emergencyContactName ?? ''} />
      </Field>
      <Field label="Emergency phone">
        <Input name="emergencyContactNumber" defaultValue={rider?.emergencyContactNumber ?? ''} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={rider?.notes ?? ''} />
      </Field>
    </div>
  );
}
