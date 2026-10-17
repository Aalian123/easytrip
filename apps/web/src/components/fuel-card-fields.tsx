'use client';

import { Field, Input, Textarea } from '@/components/form';
import { dayInput } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';

export interface FuelCardFieldValues {
  cardNumber: string;
  provider: string;
  expiryDate: string | null;
  dailyLimit: string | null;
  weeklyLimit: string | null;
  monthlyLimit: string | null;
  notes: string | null;
}

/**
 * The one set of fuel card inputs, shared by "Add fuel card" and "Edit fuel
 * card". Anything only an edit needs, such as the status, goes in `children`.
 */
export function FuelCardFields({ card, children }: { card?: FuelCardFieldValues; children?: React.ReactNode }) {
  const settings = useSettings();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Card number">
        <Input name="cardNumber" required defaultValue={card?.cardNumber} />
      </Field>
      <Field label="Provider">
        <Input name="provider" required defaultValue={card?.provider} />
      </Field>
      <Field label="Expires">
        <Input name="expiryDate" type="date" defaultValue={dayInput(card?.expiryDate)} />
      </Field>
      {children}
      <Field label={`Daily limit (${settings.currencySymbol})`} hint="Blank for no limit">
        <Input name="dailyLimit" type="number" min={0} defaultValue={card?.dailyLimit ?? ''} />
      </Field>
      <Field label={`Weekly limit (${settings.currencySymbol})`}>
        <Input name="weeklyLimit" type="number" min={0} defaultValue={card?.weeklyLimit ?? ''} />
      </Field>
      <Field label={`Monthly limit (${settings.currencySymbol})`}>
        <Input name="monthlyLimit" type="number" min={0} defaultValue={card?.monthlyLimit ?? ''} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={card?.notes ?? ''} />
      </Field>
    </div>
  );
}
