'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlateChip } from '@/components/plate-chip';
import { PageHeader, SectionTitle } from '@/components/page-header';
import { StatusChip } from '@/components/status-chip';
import { MediaLinkList, MediaLinkRow } from '@/components/media-links';
import { ReturnForm } from '@/components/return-form';
import { ComparisonTable } from '@/components/comparison-table';
import { Fact, Facts } from '@/components/facts';
import { sentence, vehicleStatus } from '@/lib/status';
import { dateTime, fuelLabel, km, money, shortDate } from '@/lib/format';
import { useSettings } from '@/lib/settings-context';
import { canManageFleet, useAuth } from '@/lib/auth-context';
import { FeatureGate } from '@/components/feature-gate';
import { FeatureKey } from '@easytrip/shared';
import { Button } from '@/components/ui/button';

interface AssignmentDetail {
  id: string;
  status: string;
  assignedAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  startMileage: number;
  endMileage: number | null;
  startFuelLevel: number | null;
  endFuelLevel: number | null;
  notes: string | null;
  returnNotes: string | null;
  vehicle: { id: string; registration: string; make: string; model: string; status: string };
  rider: { id: string; fullName: string; contactNumber: string };
  fuelCard: { id: string; cardNumber: string } | null;
  inspections: any[];
  damages: any[];
  rentalCharge: any | null;
  mediaLinks: MediaLinkRow[];
}

function AssignmentPageScreen() {
  const params = useParams<{ id: string }>();
  const settings = useSettings();
  const { user } = useAuth();
  const client = useQueryClient();
  const [returning, setReturning] = useState(false);

  const { data: assignment } = useQuery({
    queryKey: ['assignment', params.id],
    queryFn: () => api<AssignmentDetail>(`/assignments/${params.id}`),
  });

  const { data: comparison } = useQuery({
    queryKey: ['assignment-comparison', params.id],
    queryFn: () => api<any>(`/assignments/${params.id}/comparison`),
    enabled: Boolean(assignment),
  });

  if (!assignment) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-7 w-72" />
        <div className="skeleton h-72" />
      </div>
    );
  }

  const active = assignment.status === 'ACTIVE';
  const distance = assignment.endMileage != null ? assignment.endMileage - assignment.startMileage : null;

  return (
    <div>
      <PageHeader
        crumbs={[
          { href: '/operations/assignments', label: 'Assignments' },
          { label: assignment.vehicle.registration },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-x-2">
            <PlateChip
              registration={assignment.vehicle.registration}
              status={assignment.vehicle.status}
              href={`/fleet/${assignment.vehicle.id}`}
              size="lg"
            />
            <span>with</span>
            <Link href={`/riders/${assignment.rider.id}`} className="hover:underline">
              {assignment.rider.fullName}
            </Link>
          </span>
        }
        status={
          <StatusChip style={active ? vehicleStatus('ASSIGNED') : { ...vehicleStatus('AVAILABLE'), label: 'Returned' }} />
        }
        actions={
          active && canManageFleet(user?.role) ? (
            <Button type="button" onClick={() => setReturning(true)}>
              Return vehicle
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section>
            <SectionTitle as="h3">The handover</SectionTitle>
            <Facts>
              <Fact label="Assigned" value={dateTime(assignment.assignedAt)} tabular />
              <Fact
                label="Due back"
                value={assignment.expectedReturnAt ? shortDate(assignment.expectedReturnAt) : 'Open ended'}
                tabular
              />
              <Fact label="Returned" value={assignment.returnedAt ? dateTime(assignment.returnedAt) : null} tabular />
              <Fact label="Start mileage" value={km(assignment.startMileage)} tabular />
              <Fact label="End mileage" value={assignment.endMileage != null ? km(assignment.endMileage) : null} tabular />
              <Fact label="Distance" value={distance != null ? km(distance) : null} tabular />
              <Fact
                label="Fuel"
                value={`${fuelLabel(assignment.startFuelLevel)} to ${fuelLabel(assignment.endFuelLevel)}`}
              />
              <Fact label="Fuel card" value={assignment.fuelCard?.cardNumber ?? null} tabular />
              <Fact label="Rider phone" value={assignment.rider.contactNumber} tabular />
            </Facts>
          </section>

          {assignment.rentalCharge ? (
            <section>
              <SectionTitle as="h3">Rental charge</SectionTitle>
              <Facts>
                <Fact
                  label={`Rental, ${assignment.rentalCharge.billedDays} days`}
                  value={money(assignment.rentalCharge.baseAmount, settings.currencySymbol)}
                  tabular
                />
                {Number(assignment.rentalCharge.lateFee) > 0 ? (
                  <Fact
                    label={`Late, ${assignment.rentalCharge.lateDays} days`}
                    value={money(assignment.rentalCharge.lateFee, settings.currencySymbol)}
                    tabular
                  />
                ) : null}
                {Number(assignment.rentalCharge.fuelCharge) > 0 ? (
                  <Fact label="Fuel" value={money(assignment.rentalCharge.fuelCharge, settings.currencySymbol)} tabular />
                ) : null}
                {Number(assignment.rentalCharge.damageCharge) > 0 ? (
                  <Fact label="Damage" value={money(assignment.rentalCharge.damageCharge, settings.currencySymbol)} tabular />
                ) : null}
                {Number(assignment.rentalCharge.trafficFines) > 0 ? (
                  <Fact label="Fines" value={money(assignment.rentalCharge.trafficFines, settings.currencySymbol)} tabular />
                ) : null}
                {Number(assignment.rentalCharge.discount) > 0 ? (
                  <Fact
                    label="Discount"
                    value={`less ${money(assignment.rentalCharge.discount, settings.currencySymbol)}`}
                    tabular
                  />
                ) : null}
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 bg-canvas px-4 py-2.5">
                  <dt className="text-xs font-semibold leading-5 text-navy">Total</dt>
                  <dd className="tabular text-right font-bold text-navy">
                    {money(assignment.rentalCharge.totalAmount, settings.currencySymbol)}
                  </dd>
                </div>
              </Facts>
            </section>
          ) : null}
        </aside>

        <div className="space-y-6">
          {comparison ? (
            <section>
              <SectionTitle>Handover compared with return</SectionTitle>
              <ComparisonTable comparison={comparison} />
            </section>
          ) : null}

          {assignment.damages.length ? (
            <section>
              <SectionTitle>Damage from this assignment</SectionTitle>
              <div className="panel divide-y divide-line overflow-hidden">
                {assignment.damages.map((damage: any) => (
                  <div key={damage.id} className="px-4 py-2.5">
                    <p className="text-sm text-ink">
                      {sentence(damage.severity)} {sentence(damage.category).toLowerCase()}:{' '}
                      {damage.description}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Found {shortDate(damage.detectedAt)}. Responsibility{' '}
                      {sentence(damage.responsibleParty).toLowerCase()}, repair{' '}
                      {sentence(damage.repairStatus).toLowerCase()}.
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle>Photos and videos</SectionTitle>
            <MediaLinkList links={assignment.mediaLinks} />
          </section>
        </div>
      </div>

      {returning ? (
        <ReturnForm
          assignment={assignment}
          onClose={() => setReturning(false)}
          onDone={() => {
            setReturning(false);
            client.invalidateQueries({ queryKey: ['assignment', params.id] });
            client.invalidateQueries({ queryKey: ['assignment-comparison', params.id] });
          }}
        />
      ) : null}
    </div>
  );
}

export default function AssignmentPage() {
  return (
    <FeatureGate feature={FeatureKey.ASSIGNMENTS}>
      <AssignmentPageScreen />
    </FeatureGate>
  );
}
