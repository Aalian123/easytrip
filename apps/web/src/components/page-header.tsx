import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  href?: string;
  label: string;
}

/**
 * Where you are, what this is, and what you can do about it, in that order,
 * with anything the page wants to state about itself sitting on the right.
 */
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  meta,
  status,
}: {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
  meta?: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-2.5 flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight size={12} className="text-faint" /> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="crumb">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-xs font-medium text-ink">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-navy">{title}</h1>
          {status ? <div className="mt-2 flex flex-wrap items-center gap-2">{status}</div> : null}
          {description ? <p className="mt-1.5 max-w-prose text-sm text-muted">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {meta ? <div className="flex gap-5">{meta}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** A right-hand fact in the page header: a small label over a value. */
export function HeaderMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-right">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}

/** A small heading over a group of rows or a panel. */
export function SectionTitle({
  children,
  aside,
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <Tag className="text-sm font-bold text-navy">{children}</Tag>
      {aside}
    </div>
  );
}
