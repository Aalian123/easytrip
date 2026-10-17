'use client';

import { useState } from 'react';
import { ExternalLink, Link2, Trash2 } from 'lucide-react';
import { isSafeExternalUrl, LINK_PROVIDER_LABELS, detectLinkProvider } from '@easytrip/shared';
import { Input } from './form';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/delete-dialog';

export interface MediaLinkRow {
  id: string;
  url: string;
  provider: string;
  category: string;
  description?: string | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
}

/**
 * Evidence lives in the operator's own drive. This collects links, not files:
 * whoever opens one needs access to the original folder.
 */
export function MediaLinkList({ links }: { links: MediaLinkRow[] }) {
  if (!links.length) {
    return <p className="panel px-5 py-8 text-sm text-muted">No photos or videos linked yet.</p>;
  }

  return (
    <ul className="panel divide-y divide-line overflow-hidden">
      {links.map((link) => (
        <li key={link.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 truncate text-sm font-medium text-ink hover:underline"
            >
              <Link2 size={14} className="shrink-0 text-muted" />
              <span className="truncate">{link.description || link.url}</span>
              <ExternalLink size={12} className="shrink-0 text-muted" />
            </a>
            <p className="text-xs text-muted">
              {LINK_PROVIDER_LABELS[link.provider as keyof typeof LINK_PROVIDER_LABELS] ?? 'Link'},{' '}
              {link.category.toLowerCase()}
              {link.uploadedBy ? `, added by ${link.uploadedBy.name}` : ''}
            </p>
          </div>
          <DeleteButton kind="media" id={link.id} icon onDeleted={() => undefined} />
        </li>
      ))}
    </ul>
  );
}

/** Paste-a-link input used by every form that collects evidence. */
export function MediaUrlInput({
  urls,
  onChange,
  label = 'Photo or video links',
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!isSafeExternalUrl(value)) {
      setError('Enter a full http:// or https:// link');
      return;
    }
    onChange([...urls, value]);
    setDraft('');
    setError(null);
  };

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="https://drive.google.com/..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" className="shrink-0" onClick={add}>
          Add link
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-status-accident">{error}</p> : null}
      {urls.length ? (
        <ul className="mt-2 space-y-1">
          {urls.map((url, index) => (
            <li key={`${url}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1">
              <span className="truncate text-xs text-muted">
                {LINK_PROVIDER_LABELS[detectLinkProvider(url)]}, {url}
              </span>
              <Button
                type="button"
                aria-label="Remove link"
                 variant="ghost" size="icon" className="p-1"
                onClick={() => onChange(urls.filter((_, i) => i !== index))}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted">
          Paste a share link from your own drive. Anyone opening it needs access to that folder.
        </p>
      )}
    </div>
  );
}
