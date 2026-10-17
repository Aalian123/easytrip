import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/** A short fact set in a tinted rectangle. Square corners: it is a label, not a button. */
const badgeVariants = cva('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold leading-5', {
  variants: {
    variant: {
      default: 'bg-sunken text-navy',
      brand: 'bg-sky-soft text-sky-deep',
      success: 'bg-grass-soft text-grass-deep',
      warning: 'bg-[#FBF0DC] text-[#8A5600]',
      danger: 'bg-[#FBE9E8] text-status-accident',
      outline: 'border border-line-strong text-muted',
    },
    size: { default: '', sm: 'px-1.5 py-0 text-2xs leading-[18px]' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
