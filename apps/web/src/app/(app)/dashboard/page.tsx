'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, Droplet, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { RoadBar, RoadFigure } from '@/components/road-bar';
import { PlateChip } from '@/components/plate-chip';
import { SectionTitle } from '@/components/page-header';
import { money, relativeDays, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { useFeatures } from '@/lib/features-context';
import { FeatureKey } from '@easytrip/shared';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface Summary {
  fleet: { total: number; byStatus: Record<string, number> };
  riders: { total: number; active: number; holdingVehicles: number };
  fuel: { totalCards: number; assigned: number; available: number; monthlySpend: number; monthlyLitres: number };
  operations: {
    maintenanceDue: number;
    overdueVehicles: number;
    openAccidents: number;
    openDamages: number;
    outstandingRent: number;
  };
  outNow: {
    id: string;
    expectedReturnAt: string | null;
    vehicle: { id: string; registration: string; make: string; model: string };
    rider: { id: string; fullName: string };
  }[];
  recentEvents: {
    id: string;
    summary: string;
    occurredAt: string;
    vehicle: { id: string; registration: string; status: string };
    actor: { name: string } | null;
  }[];
}

export default function DashboardPage() {
  const settings = useSettings();
  const { user } = useAuth();
  // The dashboard only talks about the parts of the product that are switched
  // on, so a demo never advertises a screen that is not there.
  const { enabled } = useFeatures();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Summary>('/dashboard') });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-52 w-full rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-40 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  const attention = [
    enabled[FeatureKey.ASSIGNMENTS] && data.operations.overdueVehicles && {
      key: 'overdue',
      icon: CircleAlert,
      tone: '#D0342C',
      label: 'Overdue returns',
      count: data.operations.overdueVehicles,
      href: '/operations/assignments?status=OVERDUE',
    },
    enabled[FeatureKey.INCIDENTS] && data.operations.openAccidents && {
      key: 'accidents',
      icon: TriangleAlert,
      tone: '#D0342C',
      label: 'Accidents still open',
      count: data.operations.openAccidents,
      href: '/incidents/accidents',
    },
    enabled[FeatureKey.INCIDENTS] && data.operations.openDamages && {
      key: 'damage',
      icon: TriangleAlert,
      tone: '#C4502A',
      label: 'Damage awaiting repair',
      count: data.operations.openDamages,
      href: '/incidents/damage',
    },
    enabled[FeatureKey.MAINTENANCE] && data.operations.maintenanceDue && {
      key: 'oil',
      icon: Droplet,
      tone: '#B36F00',
      label: 'Oil changes due',
      count: data.operations.maintenanceDue,
      href: '/maintenance/oil',
    },
  ].filter(Boolean) as {
    key: string;
    icon: React.ComponentType<{ size?: number }>;
    tone: string;
    label: string;
    count: number;
    href: string;
  }[];

  const showOutNow = enabled[FeatureKey.ASSIGNMENTS];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">
            {greeting()}
            {user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </div>

      <RoadBar total={data.fleet.total} byStatus={data.fleet.byStatus}>
        <RoadFigure
          label="Riders on the road"
          value={`${data.riders.holdingVehicles}`}
          note={`of ${data.riders.active} active`}
          href="/riders?status=ACTIVE"
        />
        {enabled[FeatureKey.FUEL_CARDS] ? (
          <RoadFigure
            label="Fuel cards issued"
            value={`${data.fuel.assigned}`}
            note={`${data.fuel.available} spare of ${data.fuel.totalCards}`}
            href="/fuel/cards"
          />
        ) : null}
        {enabled[FeatureKey.FUEL_TRANSACTIONS] ? (
          <RoadFigure
            label="Fuel this month"
            value={money(data.fuel.monthlySpend, settings.currencySymbol)}
            note={`${Math.round(data.fuel.monthlyLitres)} litres`}
            href="/fuel/transactions"
          />
        ) : null}
        {enabled[FeatureKey.RENTALS] ? (
          <RoadFigure
            label="Rent still owed"
            value={money(data.operations.outstandingRent, settings.currencySymbol)}
            note="across returned rentals"
            href="/finance/rentals"
            tone={data.operations.outstandingRent > 0 ? 'warn' : 'plain'}
          />
        ) : null}
      </RoadBar>

      <div className={cn('grid gap-6', showOutNow && 'lg:grid-cols-2')}>
        <section>
          <SectionTitle>Needs you today</SectionTitle>
          <div className="panel divide-y divide-line overflow-hidden">
            {attention.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.key} href={item.href} className="row-link flex items-center gap-3 px-4 py-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${item.tone}14`, color: item.tone }}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink">{item.label}</span>
                  <span className="tabular text-base font-bold" style={{ color: item.tone }}>
                    {item.count}
                  </span>
                </Link>
              );
            })}

            {attention.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted">Nothing is overdue, damaged or due for service.</p>
            ) : null}
          </div>
        </section>

        {showOutNow ? (
          <section>
            <SectionTitle
              aside={
                <Link
                  href="/operations/assignments?status=ACTIVE"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:underline"
                >
                  See all
                  <ArrowRight size={13} />
                </Link>
              }
            >
              On the road
            </SectionTitle>
            <div className="panel divide-y divide-line overflow-hidden">
              {data.outNow.length === 0 ? (
                <div className="px-4 py-8">
                  <p className="text-sm text-muted">Every vehicle is parked up.</p>
                  {canManageFleet(user?.role) ? (
                    <Link href="/operations/assign" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
                      Assign a vehicle
                    </Link>
                  ) : null}
                </div>
              ) : (
                data.outNow.map((assignment) => {
                  const late = assignment.expectedReturnAt && new Date(assignment.expectedReturnAt) < new Date();
                  return (
                    <Link
                      key={assignment.id}
                      href={`/operations/assignments/${assignment.id}`}
                      className="row-link flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <PlateChip registration={assignment.vehicle.registration} status="ASSIGNED" size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {assignment.rider.fullName}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {assignment.vehicle.make} {assignment.vehicle.model}
                          </span>
                        </span>
                      </span>
                      <span
                        className={cn('shrink-0 text-xs font-semibold', late ? 'text-status-accident' : 'text-muted')}
                      >
                        {assignment.expectedReturnAt ? relativeDays(assignment.expectedReturnAt) : 'open ended'}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
      </div>

      <section>
        <SectionTitle>Latest activity</SectionTitle>
        <ol className="panel divide-y divide-line overflow-hidden">
          {data.recentEvents.length === 0 ? (
            <li className="px-4 py-8 text-sm text-muted">Nothing has been recorded yet.</li>
          ) : null}
          {data.recentEvents.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <PlateChip
                registration={event.vehicle.registration}
                status={event.vehicle.status}
                href={`/fleet/${event.vehicle.id}`}
                size="sm"
              />
              <span className="min-w-0 flex-1 text-sm text-ink">{event.summary}</span>
              <span className="text-xs text-muted">
                {shortDate(event.occurredAt)}
                {event.actor ? `, ${event.actor.name}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
