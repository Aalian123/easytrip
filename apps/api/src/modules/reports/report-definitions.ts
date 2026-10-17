import { PrismaService } from '../../prisma/prisma.service';

export interface ReportFilters {
  from?: Date | null;
  to?: Date | null;
  vehicleId?: string;
  riderId?: string;
  status?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  /** Right-aligned in exports; numbers are formatted with thousands separators. */
  numeric?: boolean;
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  run: (prisma: PrismaService, filters: ReportFilters) => Promise<Record<string, unknown>[]>;
}

const dateRange = (filters: ReportFilters) =>
  filters.from || filters.to
    ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) }
    : undefined;

const iso = (value: Date | null | undefined): string => (value ? value.toISOString().slice(0, 10) : '');
const money = (value: unknown): number => Number(value ?? 0);

/**
 * The reports from FR-23. Each one is a title, a column list and a query — the
 * controller turns any of them into a table, a spreadsheet or a PDF.
 */
export const REPORTS: ReportDefinition[] = [
  {
    key: 'vehicle-inventory',
    title: 'Vehicle inventory',
    description: 'Every vehicle on the books with its current state and mileage.',
    columns: [
      { key: 'registration', label: 'Registration' },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'year', label: 'Year', numeric: true },
      { key: 'category', label: 'Category' },
      { key: 'plateType', label: 'Plate' },
      { key: 'licenceClass', label: 'Licence' },
      { key: 'status', label: 'Status' },
      { key: 'currentMileage', label: 'Mileage (km)', numeric: true },
      { key: 'purchaseDate', label: 'Purchased' },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.vehicle.findMany({
        where: { ...(filters.status ? { status: filters.status as never } : {}) },
        orderBy: { registration: 'asc' },
      });
      return rows.map((v) => ({ ...v, purchaseDate: iso(v.purchaseDate) }));
    },
  },
  {
    key: 'vehicle-availability',
    title: 'Vehicle availability',
    description: 'How many vehicles sit in each state right now.',
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Vehicles', numeric: true },
    ],
    run: async (prisma) => {
      const rows = await prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true } });
      return rows.map((row) => ({ status: row.status, count: row._count._all }));
    },
  },
  {
    key: 'assignment-history',
    title: 'Vehicle assignment history',
    description: 'Every handover and return in the period.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'rider', label: 'Rider' },
      { key: 'assignedAt', label: 'Assigned' },
      { key: 'returnedAt', label: 'Returned' },
      { key: 'startMileage', label: 'Start km', numeric: true },
      { key: 'endMileage', label: 'End km', numeric: true },
      { key: 'distance', label: 'Distance', numeric: true },
      { key: 'status', label: 'Status' },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.vehicleAssignment.findMany({
        where: {
          assignedAt: dateRange(filters),
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.riderId ? { riderId: filters.riderId } : {}),
          ...(filters.status ? { status: filters.status as never } : {}),
        },
        orderBy: { assignedAt: 'desc' },
        include: { vehicle: true, rider: true },
      });
      return rows.map((a) => ({
        registration: a.vehicle.registration,
        rider: a.rider.fullName,
        assignedAt: iso(a.assignedAt),
        returnedAt: iso(a.returnedAt),
        startMileage: a.startMileage,
        endMileage: a.endMileage ?? '',
        distance: a.endMileage != null ? a.endMileage - a.startMileage : '',
        status: a.status,
      }));
    },
  },
  {
    key: 'rider-history',
    title: 'Rider history',
    description: 'What each rider has held, and what it cost.',
    columns: [
      { key: 'rider', label: 'Rider' },
      { key: 'nationalId', label: 'Identification' },
      { key: 'assignments', label: 'Assignments', numeric: true },
      { key: 'accidents', label: 'Accidents', numeric: true },
      { key: 'damages', label: 'Damage records', numeric: true },
      { key: 'status', label: 'Status' },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.rider.findMany({
        where: filters.riderId ? { id: filters.riderId } : undefined,
        orderBy: { fullName: 'asc' },
        include: { _count: { select: { assignments: true, accidents: true, damages: true } } },
      });
      return rows.map((r) => ({
        rider: r.fullName,
        nationalId: r.nationalId,
        assignments: r._count.assignments,
        accidents: r._count.accidents,
        damages: r._count.damages,
        status: r.status,
      }));
    },
  },
  {
    key: 'vehicle-utilisation',
    title: 'Vehicle utilisation',
    description: 'Days on hire and distance covered per vehicle.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'trips', label: 'Assignments', numeric: true },
      { key: 'daysOut', label: 'Days out', numeric: true },
      { key: 'distance', label: 'Distance (km)', numeric: true },
      { key: 'revenue', label: 'Revenue', numeric: true },
    ],
    run: async (prisma, filters) => {
      const assignments = await prisma.vehicleAssignment.findMany({
        where: { assignedAt: dateRange(filters), ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}) },
        include: { vehicle: true, rentalCharge: true },
      });
      const map = new Map<string, { registration: string; trips: number; daysOut: number; distance: number; revenue: number }>();
      for (const a of assignments) {
        const entry = map.get(a.vehicleId) ?? {
          registration: a.vehicle.registration,
          trips: 0,
          daysOut: 0,
          distance: 0,
          revenue: 0,
        };
        entry.trips += 1;
        const end = a.returnedAt ?? new Date();
        entry.daysOut += Math.max(1, Math.ceil((end.getTime() - a.assignedAt.getTime()) / 86_400_000));
        if (a.endMileage != null) entry.distance += a.endMileage - a.startMileage;
        entry.revenue += money(a.rentalCharge?.totalAmount);
        map.set(a.vehicleId, entry);
      }
      return [...map.values()].sort((a, b) => b.revenue - a.revenue);
    },
  },
  {
    key: 'maintenance',
    title: 'Maintenance',
    description: 'Every service recorded in the period.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'type', label: 'Type' },
      { key: 'performedAt', label: 'Date' },
      { key: 'mileage', label: 'Mileage', numeric: true },
      { key: 'serviceProvider', label: 'Provider' },
      { key: 'cost', label: 'Cost', numeric: true },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.maintenanceRecord.findMany({
        where: { performedAt: dateRange(filters), ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}) },
        orderBy: { performedAt: 'desc' },
        include: { vehicle: true },
      });
      return rows.map((m) => ({
        registration: m.vehicle.registration,
        type: m.type,
        performedAt: iso(m.performedAt),
        mileage: m.mileage,
        serviceProvider: m.serviceProvider ?? '',
        cost: money(m.cost),
      }));
    },
  },
  {
    key: 'oil-changes',
    title: 'Oil changes',
    description: 'Oil history and what is due next.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'lastChangeDate', label: 'Last change' },
      { key: 'lastChangeMileage', label: 'At km', numeric: true },
      { key: 'intervalKm', label: 'Interval', numeric: true },
      { key: 'currentMileage', label: 'Now at', numeric: true },
      { key: 'nextChange', label: 'Next at', numeric: true },
      { key: 'remainingKm', label: 'Remaining', numeric: true },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.vehicle.findMany({
        where: filters.vehicleId ? { id: filters.vehicleId } : undefined,
        orderBy: { registration: 'asc' },
      });
      return rows.map((v) => {
        const next =
          v.lastOilChangeMileage != null && v.oilChangeIntervalKm
            ? v.lastOilChangeMileage + v.oilChangeIntervalKm
            : null;
        return {
          registration: v.registration,
          lastChangeDate: iso(v.lastOilChangeDate),
          lastChangeMileage: v.lastOilChangeMileage ?? '',
          intervalKm: v.oilChangeIntervalKm ?? '',
          currentMileage: v.currentMileage,
          nextChange: next ?? '',
          remainingKm: next != null ? next - v.currentMileage : '',
        };
      });
    },
  },
  {
    key: 'accidents',
    title: 'Accidents',
    description: 'Reported accidents, responsibility and repair cost.',
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'registration', label: 'Vehicle' },
      { key: 'rider', label: 'Rider' },
      { key: 'occurredAt', label: 'Date' },
      { key: 'location', label: 'Location' },
      { key: 'responsibility', label: 'Responsibility' },
      { key: 'status', label: 'Status' },
      { key: 'actualRepairCost', label: 'Repair cost', numeric: true },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.accident.findMany({
        where: {
          occurredAt: dateRange(filters),
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.riderId ? { riderId: filters.riderId } : {}),
          ...(filters.status ? { status: filters.status as never } : {}),
        },
        orderBy: { occurredAt: 'desc' },
        include: { vehicle: true, rider: true },
      });
      return rows.map((a) => ({
        reference: a.reference,
        registration: a.vehicle.registration,
        rider: a.rider?.fullName ?? '',
        occurredAt: iso(a.occurredAt),
        location: a.location,
        responsibility: a.responsibility,
        status: a.status,
        actualRepairCost: money(a.actualRepairCost),
      }));
    },
  },
  {
    key: 'damage',
    title: 'Damage',
    description: 'Damage records and who carries the cost.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'rider', label: 'Rider' },
      { key: 'detectedAt', label: 'Detected' },
      { key: 'category', label: 'Category' },
      { key: 'severity', label: 'Severity' },
      { key: 'responsibleParty', label: 'Responsible' },
      { key: 'repairStatus', label: 'Repair' },
      { key: 'actualCost', label: 'Cost', numeric: true },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.damage.findMany({
        where: {
          detectedAt: dateRange(filters),
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.riderId ? { riderId: filters.riderId } : {}),
        },
        orderBy: { detectedAt: 'desc' },
        include: { vehicle: true, rider: true },
      });
      return rows.map((d) => ({
        registration: d.vehicle.registration,
        rider: d.rider?.fullName ?? '',
        detectedAt: iso(d.detectedAt),
        category: d.category,
        severity: d.severity,
        responsibleParty: d.responsibleParty,
        repairStatus: d.repairStatus,
        actualCost: money(d.actualCost ?? d.estimatedCost),
      }));
    },
  },
  {
    key: 'fuel-card-usage',
    title: 'Fuel card usage',
    description: 'Spend per card, and who was holding it.',
    columns: [
      { key: 'cardNumber', label: 'Card' },
      { key: 'provider', label: 'Provider' },
      { key: 'holder', label: 'Current holder' },
      { key: 'transactions', label: 'Transactions', numeric: true },
      { key: 'litres', label: 'Litres', numeric: true },
      { key: 'amount', label: 'Spend', numeric: true },
    ],
    run: async (prisma, filters) => {
      const cards = await prisma.fuelCard.findMany({
        include: {
          transactions: { where: { occurredAt: dateRange(filters) } },
          assignments: {
            where: { releasedAt: null },
            take: 1,
            include: { rider: true, vehicle: true },
          },
        },
        orderBy: { cardNumber: 'asc' },
      });
      return cards.map((card) => ({
        cardNumber: card.cardNumber,
        provider: card.provider,
        holder:
          card.assignments[0]?.rider?.fullName ?? card.assignments[0]?.vehicle?.registration ?? 'Unassigned',
        transactions: card.transactions.length,
        litres: card.transactions.reduce((sum, t) => sum + Number(t.litres), 0),
        amount: card.transactions.reduce((sum, t) => sum + Number(t.amount), 0),
      }));
    },
  },
  {
    key: 'fuel-expenses',
    title: 'Fuel expenses',
    description: 'Every fuel purchase in the period.',
    columns: [
      { key: 'occurredAt', label: 'Date' },
      { key: 'cardNumber', label: 'Card' },
      { key: 'registration', label: 'Vehicle' },
      { key: 'rider', label: 'Rider' },
      { key: 'station', label: 'Station' },
      { key: 'litres', label: 'Litres', numeric: true },
      { key: 'amount', label: 'Amount', numeric: true },
      { key: 'flagged', label: 'Over limit' },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.fuelTransaction.findMany({
        where: {
          occurredAt: dateRange(filters),
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.riderId ? { riderId: filters.riderId } : {}),
        },
        orderBy: { occurredAt: 'desc' },
        include: { fuelCard: true, vehicle: true, rider: true },
      });
      return rows.map((t) => ({
        occurredAt: iso(t.occurredAt),
        cardNumber: t.fuelCard.cardNumber,
        registration: t.vehicle?.registration ?? '',
        rider: t.rider?.fullName ?? '',
        station: t.station ?? '',
        litres: Number(t.litres),
        amount: Number(t.amount),
        flagged: t.flagged ? 'Yes' : '',
      }));
    },
  },
  {
    key: 'rental-income',
    title: 'Rental income',
    description: 'What was billed and what has been collected.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'rider', label: 'Rider' },
      { key: 'billedDays', label: 'Days', numeric: true },
      { key: 'baseAmount', label: 'Rental', numeric: true },
      { key: 'extras', label: 'Extras', numeric: true },
      { key: 'discount', label: 'Discount', numeric: true },
      { key: 'totalAmount', label: 'Total', numeric: true },
      { key: 'paidAmount', label: 'Paid', numeric: true },
      { key: 'paymentStatus', label: 'Status' },
    ],
    run: async (prisma, filters) => {
      const rows = await prisma.rentalCharge.findMany({
        where: {
          createdAt: dateRange(filters),
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.riderId ? { assignment: { riderId: filters.riderId } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { vehicle: true, assignment: { include: { rider: true } } },
      });
      return rows.map((c) => ({
        registration: c.vehicle.registration,
        rider: c.assignment.rider.fullName,
        billedDays: c.billedDays,
        baseAmount: money(c.baseAmount),
        extras:
          money(c.lateFee) + money(c.fuelCharge) + money(c.damageCharge) + money(c.trafficFines) + money(c.otherCharges),
        discount: money(c.discount),
        totalAmount: money(c.totalAmount),
        paidAmount: money(c.paidAmount),
        paymentStatus: c.paymentStatus,
      }));
    },
  },
  {
    key: 'vehicle-expenses',
    title: 'Vehicle expenses',
    description: 'Maintenance, fuel and repair cost per vehicle.',
    columns: [
      { key: 'registration', label: 'Vehicle' },
      { key: 'maintenance', label: 'Maintenance', numeric: true },
      { key: 'fuel', label: 'Fuel', numeric: true },
      { key: 'repairs', label: 'Accident repairs', numeric: true },
      { key: 'total', label: 'Total', numeric: true },
    ],
    run: async (prisma, filters) => {
      const vehicles = await prisma.vehicle.findMany({
        where: filters.vehicleId ? { id: filters.vehicleId } : undefined,
        include: {
          maintenance: { where: { performedAt: dateRange(filters) } },
          fuelTransactions: { where: { occurredAt: dateRange(filters) } },
          accidents: { where: { occurredAt: dateRange(filters) } },
        },
        orderBy: { registration: 'asc' },
      });
      return vehicles.map((v) => {
        const maintenance = v.maintenance.reduce((sum, m) => sum + money(m.cost), 0);
        const fuel = v.fuelTransactions.reduce((sum, t) => sum + money(t.amount), 0);
        const repairs = v.accidents.reduce((sum, a) => sum + money(a.actualRepairCost), 0);
        return {
          registration: v.registration,
          maintenance,
          fuel,
          repairs,
          total: maintenance + fuel + repairs,
        };
      });
    },
  },
  {
    key: 'expiring-documents',
    title: 'Expiring documents',
    description: 'Vehicle and rider paperwork coming up for renewal.',
    columns: [
      { key: 'title', label: 'Document' },
      { key: 'docType', label: 'Type' },
      { key: 'owner', label: 'Belongs to' },
      { key: 'expiresAt', label: 'Expires' },
      { key: 'daysLeft', label: 'Days left', numeric: true },
    ],
    run: async (prisma, filters) => {
      const until = filters.to ?? new Date(Date.now() + 90 * 86_400_000);
      const documents = await prisma.document.findMany({
        where: { expiresAt: { not: null, lte: until } },
        orderBy: { expiresAt: 'asc' },
      });

      const vehicleIds = documents.filter((d) => d.ownerType === 'VEHICLE').map((d) => d.ownerId);
      const riderIds = documents.filter((d) => d.ownerType === 'RIDER').map((d) => d.ownerId);
      const [vehicles, riders] = await Promise.all([
        prisma.vehicle.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, registration: true } }),
        prisma.rider.findMany({ where: { id: { in: riderIds } }, select: { id: true, fullName: true } }),
      ]);
      const names = new Map<string, string>([
        ...vehicles.map((v) => [v.id, v.registration] as const),
        ...riders.map((r) => [r.id, r.fullName] as const),
      ]);

      return documents.map((d) => ({
        title: d.title,
        docType: d.docType,
        owner: names.get(d.ownerId) ?? d.ownerType,
        expiresAt: iso(d.expiresAt),
        daysLeft: Math.ceil((d.expiresAt!.getTime() - Date.now()) / 86_400_000),
      }));
    },
  },
];

export const REPORT_INDEX = new Map(REPORTS.map((report) => [report.key, report]));
