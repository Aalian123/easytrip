import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The full lockup. `tone="light"` swaps in the version whose wordmark is white,
 * for the dark rail; the pin keeps its own colours either way.
 */
export function Logo({
  className,
  priority,
  tone = 'dark',
}: {
  className?: string;
  priority?: boolean;
  tone?: 'dark' | 'light';
}) {
  return (
    <Image
      src={tone === 'light' ? '/easytrip-logo-light.png' : '/easytrip-logo.png'}
      alt="easytrip"
      width={1681}
      height={713}
      priority={priority}
      className={cn('h-8 w-auto', className)}
    />
  );
}

/** The pin on its own, for tight spaces: the phone header and the collapsed rail. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/easytrip-mark.png"
      alt=""
      width={361}
      height={638}
      className={cn('h-7 w-auto', className)}
    />
  );
}
