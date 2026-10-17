'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, TriangleAlert } from 'lucide-react';
import type { DeletionKind, DeletionPreview } from '@easytrip/shared';
import { api } from '@/lib/api';
import { canDelete, useAuth } from '@/lib/auth-context';
import { Field, FormError, Input } from '@/components/form';
import { Modal } from '@/components/modal';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const NOUNS: Record<DeletionKind, string> = {
  vehicle: 'vehicle',
  rider: 'rider',
  'fuel-card': 'fuel card',
  damage: 'damage record',
  accident: 'accident',
  user: 'user',
  document: 'document',
  media: 'link',
};

/**
 * The delete control, shown to administrators only. It opens a confirmation
 * that states, from the API, everything the deletion takes with it.
 */
export function DeleteButton({
  kind,
  id,
  onDeleted,
  icon,
  className,
}: {
  kind: DeletionKind;
  id: string;
  onDeleted: () => void;
  /** A small bin icon for rows in a list, instead of a labelled button. */
  icon?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!canDelete(user?.role)) return null;

  return (
    <>
      {icon ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${NOUNS[kind]}`}
          className={cn('h-8 w-8 hover:text-status-accident', className)}
          onClick={() => setOpen(true)}
        >
          <Trash2 size={14} />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn('text-status-accident hover:border-status-accident/40', className)}
          onClick={() => setOpen(true)}
        >
          <Trash2 size={14} />
          Delete
        </Button>
      )}
      {open ? (
        <DeleteDialog
          kind={kind}
          id={id}
          onClose={() => setOpen(false)}
          onDeleted={() => {
            setOpen(false);
            onDeleted();
          }}
        />
      ) : null}
    </>
  );
}

function DeleteDialog({
  kind,
  id,
  onClose,
  onDeleted,
}: {
  kind: DeletionKind;
  id: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const noun = NOUNS[kind];

  const preview = useQuery({
    queryKey: ['deletion-preview', kind, id],
    queryFn: () => api<DeletionPreview>(`/deletions/${kind}/${id}`),
    gcTime: 0,
    staleTime: 0,
  });

  const remove = useMutation({
    mutationFn: () => api(`/deletions/${kind}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.confirm(`${preview.data?.label ?? `The ${noun}`} deleted.`);
      onDeleted();
      // Counts, lists and timelines anywhere in the app may have included it.
      // The preview is left out: refetching it now would only find it gone.
      client.removeQueries({ queryKey: ['deletion-preview', kind, id] });
      client.invalidateQueries({ predicate: (cached) => cached.queryKey[0] !== 'deletion-preview' });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const plan = preview.data;
  const confirmed = !plan?.confirmText || typed.trim() === plan.confirmText;

  return (
    <Modal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={`Delete ${noun}`}
      description={plan ? plan.label : undefined}
    >
      {preview.isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      ) : preview.error ? (
        <FormError message={(preview.error as Error).message} />
      ) : plan ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            // Opened from inside edit forms: React bubbles a submit through the
            // portal, which would otherwise save the form underneath too.
            event.stopPropagation();
            setError(null);
            if (confirmed && !plan.blockedReason) remove.mutate();
          }}
        >
          {plan.blockedReason ? (
            <p className="flex items-start gap-2 rounded-md border border-status-maintenance/30 bg-status-maintenance/5 px-3 py-2.5 text-sm text-ink">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-status-maintenance" />
              <span>{plan.blockedReason}</span>
            </p>
          ) : (
            <>
              <section>
                <p className="mb-1.5 text-xs font-semibold text-ink">Deleted permanently with it</p>
                {plan.deletes.length ? (
                  <ImpactList impacts={plan.deletes} tone="delete" />
                ) : (
                  <p className="text-sm text-muted">Nothing else. Only this {noun} is deleted.</p>
                )}
              </section>

              {plan.keeps.length ? (
                <section>
                  <p className="mb-1.5 text-xs font-semibold text-ink">Kept, but no longer linked to it</p>
                  <ImpactList impacts={plan.keeps} tone="keep" />
                </section>
              ) : null}

              {plan.notes.length ? (
                <ul className="space-y-1 text-xs text-muted">
                  {plan.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}

              {plan.confirmText ? (
                <Field label={`Type ${plan.confirmText} to confirm`}>
                  <Input
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoComplete="off"
                    autoFocus
                    aria-label="Confirmation"
                  />
                </Field>
              ) : null}
            </>
          )}

          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {plan.blockedReason ? 'Close' : 'Cancel'}
            </Button>
            {plan.blockedReason ? null : (
              <Button type="submit" variant="danger" disabled={!confirmed || remove.isPending}>
                {remove.isPending ? 'Deleting' : `Delete ${noun}`}
              </Button>
            )}
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

function ImpactList({ impacts, tone }: { impacts: DeletionPreview['deletes']; tone: 'delete' | 'keep' }) {
  return (
    <ul className="panel divide-y divide-line overflow-hidden text-sm">
      {impacts.map((impact) => (
        <li key={impact.label} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
          <span className="text-ink">{impact.label}</span>
          <span className={cn('tabular font-semibold', tone === 'delete' ? 'text-status-accident' : 'text-muted')}>
            {impact.count.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
