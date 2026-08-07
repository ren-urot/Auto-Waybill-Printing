// src/app/api/settings/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { GET, POST } from './route';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DB_URL;
});

beforeEach(async () => {
  await testDb.delete(schema.appSettings);
});

function postRequest(body: unknown) {
  return new Request('http://localhost/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET/POST /api/settings', () => {
  it('returns null settings when no row exists yet', async () => {
    const body = await (await GET()).json();
    expect(body.settings).toBeNull();
  });

  it('creates a row on the first POST and returns it from GET', async () => {
    const response = await POST(
      postRequest({
        companyName: 'Acme Logistics',
        companyAddress: '1 Warehouse Rd',
        defaultPaperSize: 'a5',
        defaultCourier: 'LBC',
      })
    );
    expect(response.status).toBe(200);

    const body = await (await GET()).json();
    expect(body.settings.companyName).toBe('Acme Logistics');
    expect(body.settings.companyAddress).toBe('1 Warehouse Rd');
    expect(body.settings.defaultPaperSize).toBe('a5');
    expect(body.settings.defaultCourier).toBe('LBC');
  });

  it('updates the same row on a second POST rather than inserting a duplicate', async () => {
    await POST(postRequest({ companyName: 'First', defaultPaperSize: '4x6' }));
    const [created] = await testDb.select().from(schema.appSettings);

    await POST(postRequest({ companyName: 'Second', defaultPaperSize: 'letter', defaultCourier: 'J&T' }));

    const rows = await testDb.select().from(schema.appSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(created.id);
    expect(rows[0].companyName).toBe('Second');
    // The settings page used to post a hardcoded '4x6' on every save; the
    // selected size must now survive a round trip.
    expect(rows[0].defaultPaperSize).toBe('letter');
    expect(rows[0].defaultCourier).toBe('J&T');
  });

  it('rejects a body with no companyName instead of failing at the DB layer', async () => {
    const response = await POST(postRequest({ defaultPaperSize: '4x6' }));
    expect(response.status).toBe(400);
    expect(await testDb.select().from(schema.appSettings)).toHaveLength(0);
  });

  it('rejects an unknown paper size', async () => {
    const response = await POST(postRequest({ companyName: 'Acme', defaultPaperSize: 'a3' }));
    expect(response.status).toBe(400);
  });

  it('strips unknown keys rather than writing them', async () => {
    const response = await POST(postRequest({ companyName: 'Acme', id: 'not-a-real-id', bogus: 1 }));
    expect(response.status).toBe(200);
    const rows = await testDb.select().from(schema.appSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe('not-a-real-id');
  });
});
