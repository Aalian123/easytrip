'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VehicleStatus } from '@easytrip/shared';
import { vehicleStatus } from '@/lib/status';
import { cn } from '@/lib/cn';

interface RoadBarProps {
  total: number;
  byStatus: Record<string, number>;
  /** Figures that belong under the road: riders out, cards issued, money owed. */
  children?: React.ReactNode;
}

const ORDER: VehicleStatus[] = [
  'ASSIGNED',
  'AVAILABLE',
  'RESERVED',
  'MAINTENANCE',
  'DAMAGED',
  'ACCIDENT',
  'OUT_OF_SERVICE',
  'INACTIVE',
];

/**
 * The whole fleet as one stretch of road, the shape from the easytrip mark
 * doing work. Each lane is sized by how many vehicles are in that state and
 * takes you to them. It is the one dark thing on the page: everything else
 * sits quietly on white so this reads first.
 */
export function RoadBar({ total, byStatus, children }: RoadBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const lanes = ORDER.map((status) => ({
    status,
    count: byStatus[status] ?? 0,
    style: vehicleStatus(status),
  })).filter((lane) => lane.count > 0);

  if (total === 0) {
    return (
      <div className="panel px-5 py-8 text-sm text-muted">
        No vehicles yet. Add your first one from Fleet and it will show up here.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl bg-navy text-white">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-6 pb-4 pt-5">
        <div>
          <p className="text-sm text-white/65">Fleet right now</p>
          <p className="tabular text-4xl font-bold leading-none">{total}</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {lanes.map((lane) => (
            <Link
              key={lane.status}
              href={`/fleet?status=${lane.status}`}
              className="group flex items-baseline gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <dd className="tabular text-lg font-bold leading-none">{lane.count}</dd>
              <dt className="flex items-center gap-1.5 text-xs text-white/70 group-hover:text-white">
                <span aria-hidden className="h-2 w-2 rounded-sm" style={{ backgroundColor: lane.style.hex }} />
                {lane.style.label}
              </dt>
            </Link>
          ))}
        </dl>
      </div>

      <div className="px-6 pb-6">
        <div className="flex h-14 w-full overflow-hidden rounded-md bg-white/10">
          {lanes.map((lane) => {
            const share = (lane.count / total) * 100;
            return (
              <button
                key={lane.status}
                type="button"
                onClick={() => router.push(`/fleet?status=${lane.status}`)}
                title={`${lane.style.label}: ${lane.count}`}
                aria-label={`${lane.style.label}: ${lane.count} vehicles. Open the list.`}
                className="group relative flex items-center overflow-hidden transition-[width,filter] duration-700 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:brightness-125"
                style={{ width: open ? `${share}%` : '0%', backgroundColor: lane.style.hex }}
              >
                <span
                  aria-hidden
                  className="lane-marking absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 opacity-40"
                />
                <span className="relative truncate px-3 text-left font-bold text-white">
                  <span className="tabular block text-base leading-tight">{lane.count}</span>
                  {/* The label only appears where the lane is wide enough to hold it whole. */}
                  {share > 14 ? (
                    <span className="hidden text-xs font-semibold opacity-90 sm:block">{lane.style.label}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {children ? (
        <div className="flex flex-wrap divide-x divide-white/10 border-t border-white/10">{children}</div>
      ) : null}
    </section>
  );
}

/** One fact in the strip under the road. */
export function RoadFigure({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  href: string;
  tone?: 'plain' | 'warn';
}) {
  return (
    <Link
      href={href}
      className="min-w-[11rem] max-w-[22rem] flex-1 px-6 py-3.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
    >
      <span className="block text-xs text-white/65">{label}</span>
      <span className={cn('tabular mt-0.5 block text-lg font-bold leading-tight', tone === 'warn' && 'text-[#FFB4A8]')}>
        {value}
      </span>
      {note ? <span className="block text-xs text-white/55">{note}</span> : null}
    </Link>
  );
}
