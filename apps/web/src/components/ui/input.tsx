'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink transition',
        'placeholder:text-faint hover:border-muted/60 focus:border-sky focus:outline-none focus:ring-[3px] focus:ring-sky/15',
        'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
