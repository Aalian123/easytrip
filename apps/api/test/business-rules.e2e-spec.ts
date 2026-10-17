
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { prepareTestDatabase, TEST_DATABASE_URL } from './setup-db';

prepareTestDatabase();

// Imported after the environment is pointed at the test database.
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { requestContext } from '../src/context/request-context';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

let app: NestFastifyApplication;
let token: string;
let managerToken: string;
let riderToken: string;
let riderProfileId: string;
let otherRiderId: string;

const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

async function request(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<{ status: number; body: any }> {
  const response = await app.inject({
    method: method as never,
    url: path,
    payload: options.body as never,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : undefined,
  });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
}

async function makeVehicle(status: 'AVAILABLE' | 'MAINTENANCE' = 'AVAILABLE') {
  const vehicle = await prisma.vehicle.create({
    data: {
      registration: unique('TST'),
      make: 'Toyota',
      model: 'Corolla',
      year: 2022,
      color: 'White',
      category: 'Sedan',
      currentMileage: 10_000,
      status,
      oilChangeIntervalKm: 5000,
      lastOilChangeMileage: 9000,
    },
  });
  await prisma.rentalRate.create({
    data: { vehicleId: vehicle.id, dailyRate: 5000, weeklyRate: 30000, effectiveFrom: new Date(Date.now() - 86_400_000) },
  });
  return vehicle;
}

async function makeRider() {
  return prisma.rider.create({
    data: { fullName: unique('Rider'), nationalId: unique('ID'), contactNumber: '+92 300 0000000' },
  });
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ logger: false }));
  await app.register(fastifyCookie as never);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (_request: unknown, _reply: unknown, done: () => void) => {
      requestContext.enterWith({});
      done();
    });
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const passwordHash = await argon2.hash('test12345', { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: 'e2e-admin@easytrip.local' },
    update: { passwordHash, role: 'ADMIN', isActive: true },
    create: { email: 'e2e-admin@easytrip.local', name: 'E2E Admin', role: 'ADMIN', passwordHash },
  });
  await prisma.user.upsert({
    where: { email: 'e2e-manager@easytrip.local' },
    update: { passwordHash, role: 'FLEET_MANAGER', isActive: true },
    create: { email: 'e2e-manager@easytrip.local', name: 'E2E Manager', role: 'FLEET_MANAGER', passwordHash },
  });

  const riderProfile = await makeRider();
  riderProfileId = riderProfile.id;
  const other = await makeRider();
  otherRiderId = other.id;

  await prisma.user.upsert({
    where: { email: 'e2e-rider@easytrip.local' },
    update: { passwordHash, role: 'RIDER', riderId: riderProfile.id, isActive: true },
    create: {
      email: 'e2e-rider@easytrip.local',
      name: riderProfile.fullName,
      role: 'RIDER',
      passwordHash,
      riderId: riderProfile.id,
    },
  });

  const login = async (email: string) =>
    (await request('POST', '/auth/login', { body: { email, password: 'test12345' } })).body.accessToken as string;

  token = await login(admin.email);
  managerToken = await login('e2e-manager@easytrip.local');
  riderToken = await login('e2e-rider@easytrip.local');
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('BR-01 only an available vehicle can be assigned', () => {
  it('refuses a vehicle that is in maintenance', async () => {
    const vehicle = await makeVehicle('MAINTENANCE');
    const rider = await makeRider();

    const response = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: rider.id, startMileage: 10_000 },
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('not available');
  });
});

describe('BR-02 a vehicle has at most one active assignment', () => {
  it('refuses a second assignment through the API', async () => {
    const vehicle = await makeVehicle();
    const first = await makeRider();
    const second = await makeRider();

    const created = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: first.id, startMileage: 10_000 },
    });
    expect(created.status).toBe(201);

    const duplicate = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: second.id, startMileage: 10_000 },
    });
    expect(duplicate.status).toBe(409);
  });

  it('is enforced by the database when the service check is bypassed', async () => {
    const vehicle = await makeVehicle();
    const rider = await makeRider();
    await prisma.vehicleAssignment.create({
      data: { vehicleId: vehicle.id, riderId: rider.id, assignedAt: new Date(), startMileage: 10_000 },
    });

    await expect(
      prisma.vehicleAssignment.create({
        data: { vehicleId: vehicle.id, riderId: rider.id, assignedAt: new Date(), startMileage: 10_000 },
      }),
    ).rejects.toThrow();
  });
});

describe('BR-03 a rider holds one vehicle unless settings allow more', () => {
  it('refuses a second vehicle for the same rider', async () => {
    const rider = await makeRider();
    const first = await makeVehicle();
    const second = await makeVehicle();

    await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: first.id, riderId: rider.id, startMileage: 10_000 },
    });
    const response = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: second.id, riderId: rider.id, startMileage: 10_000 },
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('already has');
  });
});

describe('BR-05 a submitted inspection is frozen', () => {
  it('rejects an edit at the database level', async () => {
    const vehicle = await makeVehicle();
    const rider = await makeRider();
    const assignment = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: rider.id, startMileage: 10_000 },
    });

    const inspection = await request('POST', `/assignments/${assignment.body.id}/inspections`, {
      token: managerToken,
      body: {
        type: 'HANDOVER',
        mileage: 10_000,
        fuelLevel: 8,
        checklist: { exterior: { grade: 'OK' } },
        mediaUrls: [],
      },
    });
    expect(inspection.status).toBe(201);

    await expect(
      prisma.inspection.update({ where: { id: inspection.body.id }, data: { mileage: 1 } }),
    ).rejects.toThrow();
  });
});

describe('BR-06 damage found at return attaches to that assignment', () => {
  it('links new damage and charges the rental', async () => {
    const vehicle = await makeVehicle();
    const rider = await makeRider();
    const assignment = await request('POST', '/assignments', {
      token: managerToken,
      body: {
        vehicleId: vehicle.id,
        riderId: rider.id,
        startMileage: 10_000,
        // Just inside three days: billing rounds part days up, so a rental a
        // minute older than this would be a four-day charge.
        assignedAt: new Date(Date.now() - 3 * 86_400_000 + 60_000).toISOString(),
      },
    });

    const returned = await request('POST', `/assignments/${assignment.body.id}/return`, {
      token: managerToken,
      body: {
        endMileage: 10_600,
        endFuelLevel: 3,
        newDamages: [
          { category: 'DENT', severity: 'MODERATE', description: 'Right door dent', responsibleParty: 'RIDER' },
        ],
        vehicleStatusAfter: 'DAMAGED',
      },
    });

    expect(returned.status).toBe(201);
    expect(returned.body.charge.billedDays).toBe(3);
    expect(returned.body.charge.total).toBe(15000);

    const damage = await prisma.damage.findFirst({ where: { assignmentId: assignment.body.id } });
    expect(damage).not.toBeNull();
    expect(damage?.responsibleParty).toBe('RIDER');

    const after = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
    expect(after?.status).toBe('DAMAGED');
    expect(after?.currentMileage).toBe(10_600);
  });
});

describe('BR-08 maintenance records only accumulate', () => {
  it('rejects an update to a service record', async () => {
    const vehicle = await makeVehicle();
    const record = await request('POST', '/maintenance', {
      token: managerToken,
      body: { vehicleId: vehicle.id, type: 'BRAKE_PADS', mileage: 10_500, cost: 4000, mediaUrls: [] },
    });
    expect(record.status).toBe(201);

    await expect(
      prisma.maintenanceRecord.update({ where: { id: record.body.id }, data: { cost: 1 } }),
    ).rejects.toThrow();
  });
});

describe('FR-14 engine oil is recorded one way, as a service', () => {
  it('moves the oil counter and interval, but not backwards for an older change', async () => {
    const vehicle = await makeVehicle();
    const log = (mileage: number, intervalKm?: number) =>
      request('POST', '/maintenance', {
        token: managerToken,
        body: { vehicleId: vehicle.id, type: 'ENGINE_OIL', mileage, intervalKm, mediaUrls: [] },
      });

    const first = await log(12_000, 6000);
    expect(first.status).toBe(201);
    expect(first.body.nextServiceMileage).toBe(18_000);
    let after = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
    expect(after?.lastOilChangeMileage).toBe(12_000);
    expect(after?.oilChangeIntervalKm).toBe(6000);

    const event = await prisma.vehicleEvent.findFirst({ where: { vehicleId: vehicle.id, type: 'OIL_CHANGED' } });
    expect(event?.summary).toContain('next due at 18,000 km');

    expect((await log(11_000)).status).toBe(201);
    after = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
    expect(after?.lastOilChangeMileage).toBe(12_000);
    expect(after?.currentMileage).toBe(12_000);
  });
});

describe('vehicle status stays in step with assignments and incidents', () => {
  it('will not put a vehicle on the road, or take one off it, by hand', async () => {
    const vehicle = await makeVehicle();
    const toRoad = await request('POST', `/vehicles/${vehicle.id}/status`, {
      token: managerToken,
      body: { status: 'ASSIGNED' },
    });
    expect(toRoad.status).toBe(409);

    const rider = await makeRider();
    await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: rider.id, startMileage: 10_000 },
    });
    const whileOut = await request('POST', `/vehicles/${vehicle.id}/status`, {
      token: managerToken,
      body: { status: 'AVAILABLE' },
    });
    expect(whileOut.status).toBe(409);
    expect(whileOut.body.message).toContain('Record its return');
  });

  it('takes a parked vehicle off the road when an accident is reported', async () => {
    const vehicle = await makeVehicle();
    const response = await request('POST', '/accidents', {
      token: managerToken,
      body: {
        vehicleId: vehicle.id,
        occurredAt: new Date().toISOString(),
        location: 'Yard',
        description: 'Reversed into a pillar',
        mediaUrls: [],
      },
    });
    expect(response.status).toBe(201);
    expect((await prisma.vehicle.findUnique({ where: { id: vehicle.id } }))?.status).toBe('ACCIDENT');
  });

  it('ignores mileage and oil readings sent with a detail edit', async () => {
    const vehicle = await makeVehicle();
    const response = await request('PATCH', `/vehicles/${vehicle.id}`, {
      token: managerToken,
      body: { color: 'Red', currentMileage: 1, lastOilChangeMileage: 1 },
    });
    expect(response.status).toBe(200);
    const after = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
    expect(after?.color).toBe('Red');
    expect(after?.currentMileage).toBe(10_000);
    expect(after?.lastOilChangeMileage).toBe(9000);
  });
});

describe('BR-09 fuel card holding history is preserved', () => {
  it('keeps one open holder per card', async () => {
    const card = await prisma.fuelCard.create({
      data: { cardNumber: unique('CARD'), provider: 'PSO', dailyLimit: 5000 },
    });
    const rider = await makeRider();

    const issued = await request('POST', `/fuel/cards/${card.id}/assign`, {
      token: managerToken,
      body: { riderId: rider.id },
    });
    expect(issued.status).toBe(201);

    const again = await request('POST', `/fuel/cards/${card.id}/assign`, {
      token: managerToken,
      body: { riderId: rider.id },
    });
    expect(again.status).toBe(409);

    await request('POST', `/fuel/cards/${card.id}/release`, { token: managerToken });
    const reissued = await request('POST', `/fuel/cards/${card.id}/assign`, {
      token: managerToken,
      body: { riderId: rider.id },
    });
    expect(reissued.status).toBe(201);

    const history = await prisma.fuelCardAssignment.findMany({ where: { fuelCardId: card.id } });
    expect(history).toHaveLength(2);
  });
});

describe('BR-10 fuel purchases are checked against the card limits', () => {
  it('flags a purchase that breaks the daily limit', async () => {
    const card = await prisma.fuelCard.create({
      data: { cardNumber: unique('CARD'), provider: 'Shell', dailyLimit: 5000 },
    });

    const response = await request('POST', '/fuel/transactions', {
      token: managerToken,
      body: { fuelCardId: card.id, litres: 40, amount: 9000 },
    });

    expect(response.status).toBe(201);
    expect(response.body.transaction.flagged).toBe(true);
    expect(response.body.transaction.flagReason).toContain('daily limit exceeded');
  });
});

describe('BR-12 an expired or blocked card cannot be issued', () => {
  it('refuses a blocked card', async () => {
    const card = await prisma.fuelCard.create({
      data: { cardNumber: unique('CARD'), provider: 'PSO', status: 'BLOCKED' },
    });
    const rider = await makeRider();

    const response = await request('POST', `/fuel/cards/${card.id}/assign`, {
      token: managerToken,
      body: { riderId: rider.id },
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('blocked');
  });

  it('refuses a card that expired yesterday', async () => {
    const card = await prisma.fuelCard.create({
      data: {
        cardNumber: unique('CARD'),
        provider: 'PSO',
        expiryDate: new Date(Date.now() - 86_400_000),
      },
    });

    const response = await request('POST', `/fuel/cards/${card.id}/assign`, {
      token: managerToken,
      body: { vehicleId: (await makeVehicle()).id },
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('expired');
  });
});

describe('riders only see their own records', () => {
  it('refuses another rider profile', async () => {
    const response = await request('GET', `/riders/${otherRiderId}`, { token: riderToken });
    expect(response.status).toBe(403);
  });

  it('allows their own profile', async () => {
    const response = await request('GET', `/riders/${riderProfileId}`, { token: riderToken });
    expect(response.status).toBe(200);
  });

  it("refuses another rider's assignment", async () => {
    const vehicle = await makeVehicle();
    const assignment = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: otherRiderId, startMileage: 10_000 },
    });

    const response = await request('GET', `/assignments/${assignment.body.id}`, { token: riderToken });
    expect(response.status).toBe(403);
  });

  it('refuses to let a rider add a vehicle', async () => {
    const response = await request('POST', '/vehicles', {
      token: riderToken,
      body: { registration: unique('NOPE'), make: 'X', model: 'Y', year: 2024, color: 'Red', category: 'Sedan' },
    });
    expect(response.status).toBe(403);
  });
});

describe('FR-24 the audit trail cannot be rewritten', () => {
  it('records the acting user and refuses edits', async () => {
    await request('PATCH', '/settings', { token, body: { alertLeadDays: 25 } });

    const entry = await prisma.auditLog.findFirst({
      where: { recordType: 'Settings' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry?.userLabel).toContain('E2E Admin');

    await expect(
      prisma.auditLog.update({ where: { id: entry!.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow();
  });
});

describe('the vehicle timeline is never rewritten', () => {
  it('rejects edits and deletes of timeline entries', async () => {
    const vehicle = await makeVehicle();
    await request('POST', `/vehicles/${vehicle.id}/status`, {
      token: managerToken,
      body: { status: 'MAINTENANCE', reason: 'brake pads' },
    });

    const event = await prisma.vehicleEvent.findFirst({ where: { vehicleId: vehicle.id } });
    expect(event).not.toBeNull();

    await expect(
      prisma.vehicleEvent.update({ where: { id: event!.id }, data: { summary: 'rewritten' } }),
    ).rejects.toThrow();
    await expect(prisma.vehicleEvent.delete({ where: { id: event!.id } })).rejects.toThrow();
  });
});

describe('only an administrator can delete, and history goes only with its record', () => {
  it('refuses a fleet manager', async () => {
    const vehicle = await makeVehicle();
    const preview = await request('GET', `/deletions/vehicle/${vehicle.id}`, { token: managerToken });
    const removal = await request('DELETE', `/deletions/vehicle/${vehicle.id}`, { token: managerToken });
    expect(preview.status).toBe(403);
    expect(removal.status).toBe(403);
    expect(await prisma.vehicle.findUnique({ where: { id: vehicle.id } })).not.toBeNull();
  });

  it('previews and then removes a vehicle with everything that belongs to it', async () => {
    const vehicle = await makeVehicle();
    const rider = await makeRider();
    const assignment = await request('POST', '/assignments', {
      token: managerToken,
      body: { vehicleId: vehicle.id, riderId: rider.id, startMileage: 10_000 },
    });
    await request('POST', `/assignments/${assignment.body.id}/inspections`, {
      token: managerToken,
      body: { type: 'HANDOVER', mileage: 10_000, checklist: { exterior: { grade: 'OK' } }, mediaUrls: [] },
    });

    const blocked = await request('DELETE', `/deletions/vehicle/${vehicle.id}`, { token });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toContain('Record its return');

    await request('POST', `/assignments/${assignment.body.id}/return`, {
      token: managerToken,
      body: { endMileage: 10_200 },
    });
    await prisma.maintenanceRecord.create({
      data: { vehicleId: vehicle.id, type: 'BRAKE_PADS', performedAt: new Date(), mileage: 10_200 },
    });

    const preview = await request('GET', `/deletions/vehicle/${vehicle.id}`, { token });
    expect(preview.status).toBe(200);
    expect(preview.body.blockedReason).toBeNull();
    expect(preview.body.confirmText).toBe(vehicle.registration);
    const counted = Object.fromEntries(preview.body.deletes.map((impact: any) => [impact.label, impact.count]));
    expect(counted['Assignments']).toBe(1);
    expect(counted['Maintenance records']).toBe(1);
    expect(counted['Handover and return inspections']).toBeGreaterThanOrEqual(1);
    expect(counted['Timeline entries']).toBeGreaterThan(0);

    const removal = await request('DELETE', `/deletions/vehicle/${vehicle.id}`, { token });
    expect(removal.status).toBe(200);

    expect(await prisma.vehicle.findUnique({ where: { id: vehicle.id } })).toBeNull();
    expect(await prisma.vehicleEvent.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    expect(await prisma.maintenanceRecord.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    expect(await prisma.vehicleAssignment.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    // The rider stays; only the vehicle was deleted.
    expect(await prisma.rider.findUnique({ where: { id: rider.id } })).not.toBeNull();

    const entry = await prisma.auditLog.findFirst({ where: { recordType: 'Vehicle', recordId: vehicle.id, action: 'deleted' } });
    expect(entry?.userLabel).toContain('E2E Admin');
    expect((entry?.before as any)?.record?.registration).toBe(vehicle.registration);
  });

  it('still refuses to delete history outside an administrator deletion', async () => {
    const vehicle = await makeVehicle();
    const record = await prisma.maintenanceRecord.create({
      data: { vehicleId: vehicle.id, type: 'OTHER', performedAt: new Date(), mileage: 10_000 },
    });
    await expect(prisma.maintenanceRecord.delete({ where: { id: record.id } })).rejects.toThrow();
  });

  it('keeps the audit trail when a user is deleted, under their name', async () => {
    const passwordHash = await argon2.hash('test12345', { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: { email: `${unique('gone')}@easytrip.local`, name: 'Leaving User', role: 'VIEWER', passwordHash },
    });
    const entry = await prisma.auditLog.create({
      data: { userId: user.id, userLabel: 'Leaving User', action: 'updated', module: 'Test', recordType: 'Test' },
    });

    const removal = await request('DELETE', `/deletions/user/${user.id}`, { token });
    expect(removal.status).toBe(200);

    const kept = await prisma.auditLog.findUnique({ where: { id: entry.id } });
    expect(kept).not.toBeNull();
    expect(kept?.userId).toBeNull();
    expect(kept?.userLabel).toBe('Leaving User');
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
  });

  it('will not let an administrator delete their own account', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@easytrip.local' } });
    const removal = await request('DELETE', `/deletions/user/${admin.id}`, { token });
    expect(removal.status).toBe(409);
  });
});
