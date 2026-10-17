'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Navy is the only button colour. The one action a page wants you to take is
 * filled; everything else is outlined or plain, so the eye finds the fill.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold',
    'transition-[background-color,border-color,color,transform,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky/25',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-navy text-white hover:bg-navy-soft',
        brand: 'bg-navy text-white hover:bg-navy-soft',
        outline: 'border border-line-strong bg-surface text-navy hover:border-muted/60 hover:bg-canvas',
        ghost: 'text-muted hover:bg-sunken/70 hover:text-navy',
        danger: 'bg-status-accident text-white hover:brightness-95',
        link: 'h-auto px-0 text-sky-deep underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
