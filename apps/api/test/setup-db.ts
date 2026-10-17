import { execSync } from 'node:child_process';

/**
 * Business-rule tests run against their own database so a failed run can never
 * disturb development data.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://easytrip:easytrip@localhost:5433/easytrip_test?schema=public';

export function prepareTestDatabase(): void {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_ACCESS_SECRET = 'test-access';
  process.env.JWT_REFRESH_SECRET = 'test-refresh';

  execSync('npx prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'ignore',
  });
}
