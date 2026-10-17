'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { createDocumentSchema } from '@easytrip/shared';
import { api, query } from '@/lib/api';
import { Field, FormError, Input, SelectField } from '@/components/form';
import { shortDate } from '@/lib/format';
import { sentence } from '@/lib/status';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/delete-dialog';

interface DocumentRow {
  id: string;
  docType: string;
  title: string;
  url: string;
  issuedAt: string | null;
  expiresAt: string | null;
  addedBy: { id: string; name: string } | null;
}

const VEHICLE_TYPES = [
  'REGISTRATION',
  'INSURANCE',
  'TAX_TOKEN',
  'INSPECTION_CERTIFICATE',
  'FITNESS_CERTIFICATE',
  'PURCHASE',
  'MAINTENANCE_INVOICE',
  'ACCIDENT_REPORT',
  'OTHER',
];

const RIDER_TYPES = ['NATIONAL_ID', 'PASSPORT', 'DRIVING_LICENCE', 'EMPLOYMENT', 'AGREEMENT', 'OTHER'];

/** Documents are links with an expiry date; expiry is what drives the alerts. */
export function DocumentPanel({ ownerType, ownerId }: { ownerType: 'VEHICLE' | 'RIDER'; ownerId: string }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['documents', ownerType, ownerId],
    queryFn: () => api<DocumentRow[]>(`/documents${query({ ownerType, ownerId })}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/documents', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }),
    onError: (cause: Error) => setError(cause.message),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = createDocumentSchema.safeParse({
      ownerType,
      ownerId,
      docType: form.get('docType'),
      title: form.get('title'),
      url: form.get('url'),
      expiresAt: form.get('expiresAt') || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
      return;
    }
    save.mutate(parsed.data as Record<string, unknown>);
    event.currentTarget.reset();
  };

  const rows = data ?? [];
  const types = ownerType === 'VEHICLE' ? VEHICLE_TYPES : RIDER_TYPES;

  return (
    <div className="space-y-4">
      <div className="panel divide-y divide-line overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No documents linked yet.</p>
        ) : (
          rows.map((document) => {
            const expiring = document.expiresAt && new Date(document.expiresAt) < new Date();
            return (
              <div key={document.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline"
                >
                  {document.title}
                  <ExternalLink size={12} className="text-muted" />
                </a>
                <span className="flex items-center gap-4 text-xs text-muted">
                  <span>{sentence(document.docType)}</span>
                  <span className={expiring ? 'text-status-accident' : ''}>
                    {document.expiresAt ? `expires ${shortDate(document.expiresAt)}` : 'no expiry'}
                  </span>
                  <DeleteButton kind="document" id={document.id} icon onDeleted={() => undefined} />
                </span>
              </div>
            );
          })
        )}
      </div>

      {canManageFleet(user?.role) ? (
        <form onSubmit={submit} className="panel space-y-3 p-4">
          <p className="text-sm font-bold text-navy">Link a document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <SelectField name="docType" defaultValue={types[0]}>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {sentence(type)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Title">
              <Input name="title" required placeholder="Insurance policy 2026" />
            </Field>
            <Field label="Link" className="sm:col-span-2">
              <Input name="url" required placeholder="https://drive.google.com/..." />
            </Field>
            <Field label="Expires on" hint="Drives the renewal alert">
              <Input name="expiresAt" type="date" />
            </Field>
          </div>
          <FormError message={error} />
          <Button type="submit"  variant="outline" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Link document'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
