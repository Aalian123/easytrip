import { dateTime } from '@/lib/format';

export interface TimelineEvent {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
  payload?: Record<string, unknown> | null;
  actor?: { id: string; name: string } | null;
  assignment?: { id: string; rider?: { id: string; fullName: string } | null } | null;
}

/** Where the vehicle went; where it was worked on. Two kinds of node, one rail. */
const ON_THE_ROAD = new Set([
  'ASSIGNED',
  'RETURNED',
  'ACCIDENT_REPORTED',
  'DAMAGE_RECORDED',
  'FUEL_CARD_ASSIGNED',
  'FUEL_PURCHASED',
]);

const TONE: Record<string, string> = {
  ACCIDENT_REPORTED: '#D0342C',
  DAMAGE_RECORDED: '#C4502A',
  MAINTENANCE_PERFORMED: '#B36F00',
  OIL_CHANGED: '#B36F00',
  ASSIGNED: '#0B8BEE',
  RETURNED: '#16A02E',
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return (
      <div className="panel px-5 py-10 text-sm text-muted">
        Nothing has happened to this vehicle yet. Assigning it will start its history.
      </div>
    );
  }

  return (
    <ol className="relative pl-6">
      <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-px bg-line-strong" />
      {events.map((event) => {
        const filled = ON_THE_ROAD.has(event.type);
        const color = TONE[event.type] ?? '#8E9FB3';
        return (
          <li key={event.id} className="relative pb-4 last:pb-1">
            <span
              aria-hidden
              className="absolute -left-6 top-[5px] h-[11px] w-[11px] rounded-full border-2 bg-surface"
              style={{ borderColor: color, backgroundColor: filled ? color : '#FFFFFF' }}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="text-sm font-semibold text-navy">{event.summary}</p>
              <time
                className="text-xs text-muted"
                title={event.actor ? `Recorded by ${event.actor.name}` : 'Recorded automatically'}
              >
                {dateTime(event.occurredAt)}
              </time>
            </div>
            {event.assignment?.rider ? (
              <p className="mt-0.5 text-xs text-muted">{event.assignment.rider.fullName}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
