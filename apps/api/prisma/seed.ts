/**
 * Seeds a small but realistic fleet so every screen has something to show and
 * the acceptance walkthrough can be driven end to end. Safe to re-run.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@easytrip.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

const VEHICLES = [
  { registration: 'FLT-1042', make: 'Toyota', model: 'Corolla', year: 2021, color: 'White', category: 'Sedan', plateType: 'WHITE' as const, licenceClass: 'PRIVATE' as const, currentMileage: 48500, lastOilChangeMileage: 45000, oilChangeIntervalKm: 5000, daily: 5000, weekly: 30000, monthly: 105000 },
  { registration: 'FLT-1188', make: 'Honda', model: 'City', year: 2022, color: 'Silver', category: 'Sedan', plateType: 'WHITE' as const, licenceClass: 'PRIVATE' as const, currentMileage: 31200, lastOilChangeMileage: 30000, oilChangeIntervalKm: 5000, daily: 4500, weekly: 27000, monthly: 95000 },
  { registration: 'FLT-2207', make: 'Suzuki', model: 'Cultus', year: 2020, color: 'Blue', category: 'Hatchback', plateType: 'WHITE' as const, licenceClass: 'PRIVATE' as const, currentMileage: 74900, lastOilChangeMileage: 70500, oilChangeIntervalKm: 5000, daily: 3500, weekly: 21000, monthly: 74000 },
  { registration: 'FLT-2310', make: 'Suzuki', model: 'Alto', year: 2023, color: 'Grey', category: 'Hatchback', plateType: 'WHITE' as const, licenceClass: 'PRIVATE' as const, currentMileage: 15600, lastOilChangeMileage: 15000, oilChangeIntervalKm: 5000, daily: 3000, weekly: 18000, monthly: 63000 },
  { registration: 'FLT-3055', make: 'Toyota', model: 'Hilux', year: 2019, color: 'White', category: 'Pickup', plateType: 'YELLOW' as const, licenceClass: 'LIGHT_TRANSPORT' as const, currentMileage: 132400, lastOilChangeMileage: 128000, oilChangeIntervalKm: 7500, daily: 9000, weekly: 54000, monthly: 190000 },
  { registration: 'FLT-3141', make: 'Toyota', model: 'Hiace', year: 2018, color: 'White', category: 'Van', plateType: 'YELLOW' as const, licenceClass: 'LIGHT_TRANSPORT' as const, currentMileage: 210300, lastOilChangeMileage: 206000, oilChangeIntervalKm: 6000, daily: 8000, weekly: 48000, monthly: 168000 },
  { registration: 'FLT-4420', make: 'Honda', model: 'CD 70', year: 2024, color: 'Red', category: 'Motorcycle', plateType: 'WHITE' as const, licenceClass: 'MOTORBIKE' as const, currentMileage: 8400, lastOilChangeMileage: 7000, oilChangeIntervalKm: 2000, daily: 900, weekly: 5000, monthly: 17000 },
  { registration: 'FLT-4431', make: 'Yamaha', model: 'YBR 125', year: 2023, color: 'Black', category: 'Motorcycle', plateType: 'WHITE' as const, licenceClass: 'MOTORBIKE' as const, currentMileage: 19800, lastOilChangeMileage: 18200, oilChangeIntervalKm: 2000, daily: 1100, weekly: 6300, monthly: 21000 },
];

const RIDERS = [
  { fullName: 'Adnan Rahman', nationalId: '35201-4471902-1', contactNumber: '+92 300 4471902', licenceNumber: 'LHR-DL-88120', employmentStatus: 'Full time' },
  { fullName: 'Sana Iqbal', nationalId: '42101-8823410-6', contactNumber: '+92 321 8823410', licenceNumber: 'KHI-DL-55219', employmentStatus: 'Full time' },
  { fullName: 'Mahnoor Zaidi', nationalId: '61101-2210954-2', contactNumber: '+92 333 2210954', licenceNumber: 'ISB-DL-11940', employmentStatus: 'Contract' },
  { fullName: 'Bilal Shah', nationalId: '35202-9915473-9', contactNumber: '+92 301 9915473', licenceNumber: 'LHR-DL-72301', employmentStatus: 'Full time' },
  { fullName: 'Rehan Karim', nationalId: '42201-3390118-4', contactNumber: '+92 345 3390118', licenceNumber: 'KHI-DL-40877', employmentStatus: 'Part time' },
];

const FUEL_CARDS = [
  { cardNumber: '7043-1120-9981', provider: 'PSO', dailyLimit: 5000, weeklyLimit: 25000, monthlyLimit: 90000 },
  { cardNumber: '7043-1120-9982', provider: 'PSO', dailyLimit: 5000, weeklyLimit: 25000, monthlyLimit: 90000 },
  { cardNumber: '8811-4402-0071', provider: 'Shell', dailyLimit: 8000, weeklyLimit: 40000, monthlyLimit: 140000 },
];

const daysFromNow = (days: number): Date => new Date(Date.now() + days * 86_400_000);

async function main(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 'settings' },
    update: {},
    create: {
      id: 'settings',
      organizationName: 'EasyTrip Fleet',
      currencyCode: 'PKR',
      currencySymbol: 'Rs',
      nationalIdLabel: 'CNIC',
    },
  });

  const passwordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });

  const staff = [
    { email: ADMIN_EMAIL, name: 'System Administrator', role: 'ADMIN' as const },
    { email: 'fleet@easytrip.local', name: 'Fleet Manager', role: 'FLEET_MANAGER' as const },
    { email: 'accounts@easytrip.local', name: 'Accounts Officer', role: 'ACCOUNTS' as const },
    { email: 'viewer@easytrip.local', name: 'Read Only', role: 'VIEWER' as const },
  ];

  for (const person of staff) {
    await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, role: person.role },
      create: { ...person, passwordHash },
    });
  }

  for (const rider of RIDERS) {
    await prisma.rider.upsert({
      where: { nationalId: rider.nationalId },
      update: {},
      create: {
        ...rider,
        licenceIssuedAt: daysFromNow(-900),
        // One licence expires soon so the alerts screen has a real case.
        licenceExpiresAt: rider.fullName === 'Rehan Karim' ? daysFromNow(11) : daysFromNow(540),
        events: {
          create: { type: 'RIDER_ADDED', summary: `${rider.fullName} added to the rider list` },
        },
      },
    });
  }

  const riderLogin = await prisma.rider.findFirst({ where: { fullName: 'Adnan Rahman' } });
  if (riderLogin) {
    await prisma.user.upsert({
      where: { email: 'rider@easytrip.local' },
      update: { riderId: riderLogin.id },
      create: {
        email: 'rider@easytrip.local',
        name: riderLogin.fullName,
        role: 'RIDER',
        passwordHash,
        riderId: riderLogin.id,
      },
    });
  }

  for (const vehicle of VEHICLES) {
    const { daily, weekly, monthly, ...fields } = vehicle;
    const created = await prisma.vehicle.upsert({
      where: { registration: vehicle.registration },
      update: {},
      create: {
        ...fields,
        lastOilChangeDate: daysFromNow(-70),
        events: {
          create: {
            type: 'VEHICLE_ADDED',
            summary: `${vehicle.make} ${vehicle.model} (${vehicle.registration}) added to the fleet`,
          },
        },
      },
    });

    const hasRate = await prisma.rentalRate.findFirst({ where: { vehicleId: created.id } });
    if (!hasRate) {
      await prisma.rentalRate.create({
        data: {
          vehicleId: created.id,
          dailyRate: new Prisma.Decimal(daily),
          weeklyRate: new Prisma.Decimal(weekly),
          monthlyRate: new Prisma.Decimal(monthly),
          securityDeposit: new Prisma.Decimal(daily * 4),
          lateReturnFeePerDay: new Prisma.Decimal(Math.round(daily * 0.3)),
          // Backdated so rentals recorded for earlier dates price correctly.
          effectiveFrom: daysFromNow(-365),
        },
      });
    }
  }

  for (const card of FUEL_CARDS) {
    await prisma.fuelCard.upsert({
      where: { cardNumber: card.cardNumber },
      update: {},
      create: {
        ...card,
        dailyLimit: new Prisma.Decimal(card.dailyLimit),
        weeklyLimit: new Prisma.Decimal(card.weeklyLimit),
        monthlyLimit: new Prisma.Decimal(card.monthlyLimit),
        expiryDate: card.provider === 'Shell' ? daysFromNow(20) : daysFromNow(400),
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    vehicles: await prisma.vehicle.count(),
    riders: await prisma.rider.count(),
    fuelCards: await prisma.fuelCard.count(),
  };
  console.log('Seeded:', counts);
  console.log(`Sign in as ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
