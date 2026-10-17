'use client';

import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface Column<T> {
  key: string;
  header: string;
  numeric?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  loading?: boolean;
  /** Filters and searches that belong to this table, shown in its top edge. */
  toolbar?: React.ReactNode;
  /** What the table is a list of, e.g. "9 vehicles". Shown in the bottom edge. */
  summary?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  toolbar,
  summary,
}: DataTableProps<T>) {
  const head = toolbar ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">{toolbar}</div>
  ) : null;

  if (loading) {
    return (
      <Card className="overflow-hidden">
        {head}
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!rows.length) {
    return (
      <Card className="overflow-hidden">
        {head}
        {empty ?? <p className="px-5 py-10 text-sm text-muted">Nothing here yet.</p>}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {head}
      <div className="max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.numeric && 'text-right')}
                  style={{ width: column.width }}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn(column.numeric && 'text-right tabular')}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {summary ? (
        <div className="border-t border-line px-4 py-2 text-xs text-muted">{summary}</div>
      ) : null}
    </Card>
  );
}

/**
 * An empty table cell. Says nothing unless there is something worth saying
 * ("Not tracked"), because a column of placeholders is noise.
 */
export function None({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <span className="text-faint">{children}</span>;
}
