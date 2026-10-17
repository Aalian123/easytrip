import { fuelLabel, km } from '@/lib/format';

const GRADE_STYLE: Record<string, { label: string; color: string }> = {
  OK: { label: 'OK', color: '#0F7D23' },
  MINOR: { label: 'Minor', color: '#B36F00' },
  DAMAGE: { label: 'Damage', color: '#C4502A' },
  NA: { label: 'Not recorded', color: '#8E9FB3' },
};

interface Comparison {
  handover: unknown | null;
  return: unknown | null;
  worsenedCount: number;
  items: {
    key: string;
    label: string;
    before: string;
    after: string;
    beforeNote: string | null;
    afterNote: string | null;
    worsened: boolean;
  }[];
  mileage: { start: number; end: number | null; distance: number | null };
  fuel: { start: number | null; end: number | null };
}

/**
 * The answer to "was that dent there when it went out". Handover on the left as
 * recorded, return on the right, and anything that got worse called out.
 */
export function ComparisonTable({ comparison }: { comparison: Comparison }) {
  if (!comparison.handover && !comparison.return) {
    return <p className="panel px-5 py-8 text-sm text-muted">No inspection has been recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="panel grid grid-cols-3 divide-x divide-line overflow-hidden text-sm">
        <div className="px-4 py-3">
          <p className="text-xs text-muted">Mileage</p>
          <p className="tabular mt-0.5 font-semibold text-navy">
            {km(comparison.mileage.start)} to {comparison.mileage.end != null ? km(comparison.mileage.end) : 'now'}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted">Fuel</p>
          <p className="mt-0.5 font-semibold text-navy">
            {fuelLabel(comparison.fuel.start)} to {fuelLabel(comparison.fuel.end)}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted">Items worse</p>
          <p
            className={
              comparison.worsenedCount
                ? 'tabular mt-0.5 font-semibold text-status-accident'
                : 'tabular mt-0.5 font-semibold text-navy'
            }
          >
            {comparison.worsenedCount}
          </p>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th>Item</th>
              <th>At handover</th>
              <th>At return</th>
            </tr>
          </thead>
          <tbody>
            {comparison.items.map((item) => {
              const before = GRADE_STYLE[item.before] ?? GRADE_STYLE.NA;
              const after = GRADE_STYLE[item.after] ?? GRADE_STYLE.NA;
              return (
                <tr key={item.key} className={item.worsened ? 'bg-status-damaged/5' : undefined}>
                  <td>{item.label}</td>
                  <td>
                    <span style={{ color: before.color }}>{before.label}</span>
                    {item.beforeNote ? <span className="ml-2 text-xs text-muted">{item.beforeNote}</span> : null}
                  </td>
                  <td>
                    <span style={{ color: after.color }} className={item.worsened ? 'font-medium' : undefined}>
                      {after.label}
                    </span>
                    {item.afterNote ? <span className="ml-2 text-xs text-muted">{item.afterNote}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
