'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={props.rows ?? 3}
      className={cn(
        'flex w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink transition',
        'placeholder:text-faint hover:border-muted/60 focus:border-sky focus:outline-none focus:ring-[3px] focus:ring-sky/15',
        'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
