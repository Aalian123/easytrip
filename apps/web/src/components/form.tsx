'use client';

import * as React from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export { Input, Textarea };

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('block', className)}>
      <label className="mb-1.5 block text-xs font-semibold text-ink">{label}</label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-status-accident">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A real dropdown that still behaves like a form control.
 *
 * It takes plain `<option>` children the way a native select does, renders them
 * through the Radix listbox, and writes the choice into a hidden input so
 * forms read with FormData keep working unchanged.
 */
export function SelectField({
  name,
  value,
  defaultValue,
  onChange,
  children,
  placeholder,
  disabled,
  required,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const options: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== 'option') return;
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
    options.push({
      value: String(props.value ?? ''),
      label: String(props.children ?? ''),
      disabled: props.disabled,
    });
  });

  // Radix has no concept of an empty item, so the "nothing chosen" option
  // becomes the placeholder and is carried by a sentinel value.
  const EMPTY = '__none__';
  const emptyOption = options.find((option) => option.value === '');
  const listed = options.filter((option) => option.value !== '');

  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const current = value !== undefined ? value : internal;

  const handleChange = (next: string) => {
    const resolved = next === EMPTY ? '' : next;
    if (value === undefined) setInternal(resolved);
    onChange?.({ target: { value: resolved, name } });
  };

  return (
    <>
      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
      <Select value={current === '' ? EMPTY : current} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder ?? emptyOption?.label ?? 'Choose one'} />
        </SelectTrigger>
        <SelectContent>
          {emptyOption ? <SelectItem value={EMPTY}>{emptyOption.label}</SelectItem> : null}
          {listed.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Kept so existing forms can keep their `<option>` markup. */
export const SelectInput = SelectField;

/**
 * Reads an edit form. A field left blank becomes null so the saved record is
 * cleared, rather than dropped so the old value quietly survives.
 */
export function readEditForm(form: HTMLFormElement): Record<string, string | null> {
  return Object.fromEntries(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, value === '' ? null : String(value)]),
  );
}

/** Errors say what happened and what to do about it. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-2 rounded-md border border-status-accident/25 bg-status-accident/5 px-3 py-2.5 text-sm text-status-accident">
      <TriangleAlert size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
