const FUEL_LABELS = ['Empty', '1/8', '1/4', '3/8', 'Half', '5/8', '3/4', '7/8', 'Full'];

export function km(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${value.toLocaleString()} km`;
}

export function fuelLabel(level: number | null | undefined): string {
  if (level == null) return '-';
  return FUEL_LABELS[level] ?? String(level);
}

export function money(value: number | string | null | undefined, symbol = 'Rs'): string {
  if (value == null) return '-';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numeric)) return '-';
  return `${symbol} ${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

export function dayInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

/** "3 days late", "due in 2 days" , the phrasing operators actually use. */
export function relativeDays(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} late`;
}
