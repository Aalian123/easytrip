'use client';

import { CHECKLIST_ITEMS, Checklist, ConditionGrade } from '@easytrip/shared';
import { cn } from '@/lib/cn';

const GRADES: { value: ConditionGrade; label: string; color: string }[] = [
  // OK is the resting state, so it is set in navy: colour on this row means
  // something was found.
  { value: 'OK', label: 'OK', color: '#0E2748' },
  { value: 'MINOR', label: 'Minor', color: '#B36F00' },
  { value: 'DAMAGE', label: 'Damage', color: '#C4502A' },
];

export function emptyChecklist(): Checklist {
  return Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, { grade: 'OK' as ConditionGrade, note: '' }]));
}

/**
 * Built for a phone held in one hand beside the car: one row per item, three
 * thumb-sized choices, and a note that only appears when something is wrong.
 */
export function InspectionChecklist({
  value,
  onChange,
}: {
  value: Checklist;
  onChange: (next: Checklist) => void;
}) {
  const set = (key: string, patch: Partial<{ grade: ConditionGrade; note: string }>) => {
    onChange({ ...value, [key]: { ...(value[key] ?? { grade: 'OK' }), ...patch } });
  };

  return (
    <ol className="panel divide-y divide-line overflow-hidden">
      {CHECKLIST_ITEMS.map((item, index) => {
        const entry = value[item.key] ?? { grade: 'OK' as ConditionGrade, note: '' };
        const flagged = entry.grade === 'MINOR' || entry.grade === 'DAMAGE';
        return (
          <li key={item.key} className="px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink">
                <span className="tabular mr-2 text-xs text-faint">{index + 1}</span>
                {item.label}
              </span>
              <div className="flex overflow-hidden rounded-md border border-line-strong" role="group" aria-label={item.label}>
                {GRADES.map((grade) => {
                  const active = entry.grade === grade.value;
                  return (
                    <button
                      key={grade.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set(item.key, { grade: grade.value })}
                      className={cn(
                        'min-w-[4.5rem] px-3 py-1.5 text-sm font-medium transition-colors',
                        'border-l border-line-strong first:border-l-0',
                        active ? 'text-white' : 'bg-surface text-muted hover:bg-canvas hover:text-navy',
                      )}
                      style={active ? { backgroundColor: grade.color } : undefined}
                    >
                      {grade.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {flagged ? (
              <input
                value={entry.note ?? ''}
                onChange={(event) => set(item.key, { note: event.target.value })}
                placeholder="What did you find?"
                className="field-input mt-2"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function FuelSelect({
  value,
  onChange,
  label = 'Fuel level',
}: {
  value: number | null;
  onChange: (value: number) => void;
  label?: string;
}) {
  const labels = ['Empty', '1/8', '1/4', '3/8', 'Half', '5/8', '3/4', '7/8', 'Full'];
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-line-strong">
        {labels.map((text, level) => (
          <button
            key={text}
            type="button"
            aria-pressed={value === level}
            onClick={() => onChange(level)}
            className={cn(
              'border-l border-line-strong px-2.5 py-1.5 text-xs font-medium transition-colors first:border-l-0',
              value === level ? 'bg-navy text-white' : 'bg-surface text-muted hover:bg-canvas hover:text-navy',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
