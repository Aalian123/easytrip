import { Prisma } from '@prisma/client';

/**
 * For partial updates of optional money columns: a number is written, null
 * clears the column, and undefined leaves it untouched.
 */
export function decimalOrNull(value: number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
}
