'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { Button } from '@/components/ui/button';

interface NotificationRow {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: '#0B8BEE',
  WARNING: '#B36F00',
  CRITICAL: '#D0342C',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationRow[]>('/notifications'),
    refetchInterval: 120_000,
  });

  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = data ?? [];
  const unread = rows.filter((row) => !row.readAt).length;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative" aria-label={`Alerts, ${unread} unread`}>
          <Bell size={18} />
          {unread > 0 ? (
            <span className="tabular absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-status-accident px-1 text-center text-[10px] font-bold leading-[17px] text-white ring-2 ring-canvas">
              {unread}
            </span>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          className="z-50 w-[23rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-bold text-navy">Alerts</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs font-semibold text-sky-deep hover:underline"
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Nothing needs attention right now.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id} className={`flex gap-2.5 px-4 py-3 ${row.readAt ? '' : 'bg-sky-soft/50'}`}>
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLOR[row.severity] }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{row.title}</p>
                    {row.body ? <p className="mt-0.5 text-xs text-muted">{row.body}</p> : null}
                    <p className="mt-0.5 text-xs text-muted">{shortDate(row.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
