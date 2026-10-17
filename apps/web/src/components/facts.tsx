import { cn } from '@/lib/cn';

/**
 * A short list of labelled facts about one thing: the label column narrow and
 * quiet, the value column carrying the weight. Used down the side of every
 * detail page so the eye learns where to look.
 */
export function Facts({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn('panel divide-y divide-line overflow-hidden text-sm', className)}>{children}</dl>;
}

export function Fact({
  label,
  value,
  tabular,
  tone,
  hideEmpty,
}: {
  label: string;
  value: React.ReactNode;
  tabular?: boolean;
  tone?: string;
  /** Leave the row out entirely rather than print "None". */
  hideEmpty?: boolean;
}) {
  const empty = value == null || value === '' || value === '-';
  if (empty && hideEmpty) return null;
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2">
      <dt className="text-xs leading-5 text-muted">{label}</dt>
      <dd className={cn('min-w-0 break-words text-right', tabular && 'tabular', empty ? 'text-faint' : 'text-ink', tone)}>
        {empty ? 'None' : value}
      </dd>
    </div>
  );
}

/** Initials in a square, for a person named in a panel. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sunken text-xs font-bold text-navy',
        className,
      )}
    >
      {initials}
    </span>
  );
}
