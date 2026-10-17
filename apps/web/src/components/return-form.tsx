'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Checklist, DamageCategory, DamageSeverity, ResponsibleParty } from '@easytrip/shared';
import { useToast } from '@/components/toast';
import { api, query } from '@/lib/api';
import { Modal } from './modal';
import { Field, FormError, Input, SelectField, Textarea } from './form';
import { FuelSelect, InspectionChecklist, emptyChecklist } from './inspection-checklist';
import { MediaUrlInput } from './media-links';
import { money } from '@/lib/format';
import { sentence, vehicleStatus } from '@/lib/status';
import { useSettings } from '@/lib/settings-context';
import { Button } from '@/components/ui/button';

interface NewDamage {
  category: DamageCategory;
  severity: DamageSeverity;
  description: string;
  estimatedCost: string;
  responsibleParty: ResponsibleParty;
  chargedToRider: boolean;
  mediaUrls: string[];
}

/** Where a vehicle can go when it comes back. */
const STATUSES_AFTER_RETURN = ['AVAILABLE', 'MAINTENANCE', 'DAMAGED', 'ACCIDENT', 'OUT_OF_SERVICE'] as const;

/**
 * The return: final readings, the return inspection, anything new found, and
 * what it all comes to. The quote updates as charges are typed so the operator
 * sees the figure before committing.
 */
export function ReturnForm({
  assignment,
  onClose,
  onDone,
}: {
  assignment: { id: string; startMileage: number; vehicle: { registration: string } };
  onClose: () => void;
  onDone: () => void;
}) {
  const settings = useSettings();
  const toast = useToast();
  const [endMileage, setEndMileage] = useState(String(assignment.startMileage));
  const [fuelLevel, setFuelLevel] = useState<number | null>(4);
  const [checklist, setChecklist] = useState<Checklist>(emptyChecklist());
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [damages, setDamages] = useState<NewDamage[]>([]);
  const [charges, setCharges] = useState({
    fuelCharge: '0',
    damageCharge: '0',
    trafficFines: '0',
    otherCharges: '0',
    discount: '0',
  });
  const [statusAfter, setStatusAfter] = useState('AVAILABLE');
  const [error, setError] = useState<string | null>(null);

  const numericCharges = Object.fromEntries(
    Object.entries(charges).map(([key, value]) => [key, Number(value || 0)]),
  ) as Record<string, number>;

  const { data: quote } = useQuery({
    queryKey: ['rental-quote', assignment.id, numericCharges],
    queryFn: () => api<any>(`/rentals/quote/${assignment.id}${query(numericCharges)}`),
  });

  const submit = useMutation({
    mutationFn: () =>
      api(`/assignments/${assignment.id}/return`, {
        method: 'POST',
        body: {
          endMileage: Number(endMileage),
          endFuelLevel: fuelLevel,
          returnNotes: notes || null,
          inspection: { mileage: Number(endMileage), fuelLevel, checklist, mediaUrls },
          newDamages: damages.map((damage) => ({
            ...damage,
            estimatedCost: damage.estimatedCost ? Number(damage.estimatedCost) : null,
          })),
          ...numericCharges,
          vehicleStatusAfter: statusAfter,
        },
      }),
    onSuccess: () => {
      toast.confirm('Return recorded. The rental has been charged.');
      onDone();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const addDamage = () =>
    setDamages((current) => [
      ...current,
      {
        category: 'SCRATCH',
        severity: 'MINOR',
        description: '',
        estimatedCost: '',
        responsibleParty: 'UNDETERMINED',
        chargedToRider: false,
        mediaUrls: [],
      },
    ]);

  const patchDamage = (index: number, patch: Partial<NewDamage>) =>
    setDamages((current) => current.map((damage, i) => (i === index ? { ...damage, ...patch } : damage)));

  return (
    <Modal
      open
      wide
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={`Return ${assignment.vehicle.registration}`}
      description="Record the final readings and the condition it came back in."
    >
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (Number(endMileage) < assignment.startMileage) {
            setError(`Final mileage cannot be below the ${assignment.startMileage.toLocaleString()} km at handover.`);
            return;
          }
          submit.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Final mileage">
            <Input type="number" value={endMileage} onChange={(event) => setEndMileage(event.target.value)} />
          </Field>
          <Field label="Vehicle goes to">
            <SelectField value={statusAfter} onChange={(event) => setStatusAfter(event.target.value)}>
              {STATUSES_AFTER_RETURN.map((status) => (
                <option key={status} value={status}>
                  {vehicleStatus(status).label}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <FuelSelect value={fuelLevel} onChange={setFuelLevel} label="Fuel level at return" />

        <div>
          <p className="field-label">Return inspection</p>
          <InspectionChecklist value={checklist} onChange={setChecklist} />
        </div>

        <MediaUrlInput urls={mediaUrls} onChange={setMediaUrls} label="Return photos and videos" />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">New damage found</p>
            <Button type="button" variant="outline" className="py-1.5" onClick={addDamage}>
              Add damage
            </Button>
          </div>
          {damages.length === 0 ? (
            <p className="text-sm text-muted">Nothing new recorded. Add an entry if you found something.</p>
          ) : (
            <div className="space-y-3">
              {damages.map((damage, index) => (
                <div key={index} className="panel space-y-3 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="What is it">
                      <SelectField
                        value={damage.category}
                        onChange={(event) => patchDamage(index, { category: event.target.value as DamageCategory })}
                      >
                        {Object.values(DamageCategory).map((category) => (
                          <option key={category} value={category}>
                            {sentence(category)}
                          </option>
                        ))}
                      </SelectField>
                    </Field>
                    <Field label="Severity">
                      <SelectField
                        value={damage.severity}
                        onChange={(event) => patchDamage(index, { severity: event.target.value as DamageSeverity })}
                      >
                        {Object.values(DamageSeverity).map((severity) => (
                          <option key={severity} value={severity}>
                            {sentence(severity)}
                          </option>
                        ))}
                      </SelectField>
                    </Field>
                    <Field label="Description" className="sm:col-span-2">
                      <Input
                        value={damage.description}
                        onChange={(event) => patchDamage(index, { description: event.target.value })}
                        placeholder="Dent on the right rear door"
                      />
                    </Field>
                    <Field label="Estimated repair cost">
                      <Input
                        type="number"
                        value={damage.estimatedCost}
                        onChange={(event) => patchDamage(index, { estimatedCost: event.target.value })}
                      />
                    </Field>
                    <Field label="Responsibility">
                      <SelectField
                        value={damage.responsibleParty}
                        onChange={(event) =>
                          patchDamage(index, { responsibleParty: event.target.value as ResponsibleParty })
                        }
                      >
                        {Object.values(ResponsibleParty).map((party) => (
                          <option key={party} value={party}>
                            {sentence(party)}
                          </option>
                        ))}
                      </SelectField>
                    </Field>
                  </div>
                  <MediaUrlInput
                    urls={damage.mediaUrls}
                    onChange={(urls) => patchDamage(index, { mediaUrls: urls })}
                    label="Damage photos"
                  />
                  <Button
                    type="button"
                     variant="ghost" size="icon" className="px-0 text-xs"
                    onClick={() => setDamages((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove this damage
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Charges</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['fuelCharge', 'Fuel'],
                ['damageCharge', 'Damage'],
                ['trafficFines', 'Traffic fines'],
                ['otherCharges', 'Other'],
                ['discount', 'Discount'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  value={charges[key]}
                  onChange={(event) => setCharges((current) => ({ ...current, [key]: event.target.value }))}
                />
              </Field>
            ))}
          </div>

          {quote ? (
            <div className="panel mt-3 divide-y divide-line text-sm">
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-xs text-muted">Rental for {quote.billedDays} days</span>
                <span className="tabular">{money(quote.baseAmount, settings.currencySymbol)}</span>
              </div>
              {quote.lateDays > 0 ? (
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-xs text-muted">Late fee ({quote.lateDays} days)</span>
                  <span className="tabular">{money(quote.lateFee, settings.currencySymbol)}</span>
                </div>
              ) : null}
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-xs text-muted">Additional charges</span>
                <span className="tabular">{money(quote.additionalCharges, settings.currencySymbol)}</span>
              </div>
              <div className="flex justify-between px-3 py-2">
                <span className="font-medium">Total</span>
                <span className="tabular font-medium">{money(quote.total, settings.currencySymbol)}</span>
              </div>
            </div>
          ) : null}
        </section>

        <Field label="Return notes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? 'Recording…' : 'Record return'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
