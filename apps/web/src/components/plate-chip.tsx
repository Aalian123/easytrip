import Link from 'next/link';
import { cn } from '@/lib/cn';
import { vehicleStatus } from '@/lib/status';

interface PlateChipProps {
  registration: string;
  status?: string;
  /** Yellow plates are set on yellow, the way they look on the road. */
  plateType?: string;
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * A vehicle is named the same way everywhere in the product: its plate, set
 * like a plate, with the state carried on the leading edge. Identity and
 * condition in one object, so a row can be read without a second glance.
 */
export function PlateChip({ registration, status, plateType, href, size = 'md', className }: PlateChipProps) {
  const style = status ? vehicleStatus(status) : null;

  const chip = (
    <span
      className={cn(
        'inline-flex items-center overflow-hidden rounded border border-line-strong font-bold uppercase tracking-[0.08em] text-navy',
        plateType === 'YELLOW' ? 'bg-[#FFD84D] text-[#1A1A1A]' : 'bg-surface',
        size === 'sm' && 'h-[22px] text-2xs',
        size === 'md' && 'h-7 text-xs',
        size === 'lg' && 'h-9 text-base tracking-[0.1em]',
        href && 'transition-colors group-hover:border-navy/40',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('self-stretch', size === 'lg' ? 'w-1.5' : 'w-1')}
        style={{ backgroundColor: style?.hex ?? '#C9D4E0' }}
      />
      <span className={cn('tabular', size === 'sm' ? 'px-1.5' : size === 'md' ? 'px-2' : 'px-3')}>{registration}</span>
    </span>
  );

  if (!href) return chip;

  return (
    <Link href={href} className="group inline-block rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky/25">
      {chip}
    </Link>
  );
}
