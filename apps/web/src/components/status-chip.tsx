import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { StatusStyle } from '@/lib/status';

/** A state, said once: the word, set in the state's own colour. */
export function StatusChip({
  style,
  className,
  size = 'default',
}: {
  style: StatusStyle;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <Badge size={size} className={cn('whitespace-nowrap', className)} style={{ color: style.hex, backgroundColor: style.tint }}>
      {style.label}
    </Badge>
  );
}
