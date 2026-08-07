import { describe, it, expect } from 'vitest';
import { parseOrderFilters } from './filters';

describe('parseOrderFilters', () => {
  it('defaults sort to newest when absent or invalid', () => {
    expect(parseOrderFilters(new URLSearchParams()).sort).toBe('newest');
    expect(parseOrderFilters(new URLSearchParams('sort=bogus')).sort).toBe('newest');
  });

  it('accepts valid sort values', () => {
    expect(parseOrderFilters(new URLSearchParams('sort=oldest')).sort).toBe('oldest');
    expect(parseOrderFilters(new URLSearchParams('sort=courier')).sort).toBe('courier');
  });

  it('parses status, courier, and paymentMethod filters', () => {
    const filters = parseOrderFilters(new URLSearchParams('status=printed&courier=LBC&paymentMethod=COD'));
    expect(filters.status).toBe('printed');
    expect(filters.courier).toBe('LBC');
    expect(filters.paymentMethod).toBe('COD');
  });

  it('trims keyword and treats blank keyword as undefined', () => {
    expect(parseOrderFilters(new URLSearchParams('keyword=  hello  ')).keyword).toBe('hello');
    expect(parseOrderFilters(new URLSearchParams('keyword=   ')).keyword).toBeUndefined();
  });

  it('parses dateFrom and dateTo, and leaves them undefined when absent', () => {
    const filters = parseOrderFilters(new URLSearchParams('dateFrom=2026-08-01&dateTo=2026-08-06'));
    expect(filters.dateFrom).toBe('2026-08-01');
    expect(filters.dateTo).toBe('2026-08-06');

    const empty = parseOrderFilters(new URLSearchParams());
    expect(empty.dateFrom).toBeUndefined();
    expect(empty.dateTo).toBeUndefined();
  });

  it('round-trips full ISO timestamps for dateFrom/dateTo', () => {
    const from = '2026-08-01T00:00:00.000Z';
    const to = '2026-08-06T23:59:59.000Z';
    const params = new URLSearchParams();
    params.set('dateFrom', from);
    params.set('dateTo', to);
    const filters = parseOrderFilters(params);
    expect(filters.dateFrom).toBe(from);
    expect(filters.dateTo).toBe(to);
    // The API route feeds these straight into `new Date(...)`, so they must
    // survive parsing as something Date can actually read.
    expect(Number.isNaN(new Date(filters.dateFrom!).getTime())).toBe(false);
    expect(Number.isNaN(new Date(filters.dateTo!).getTime())).toBe(false);
  });

  it('ignores a platform param — orders have no platform column to filter on', () => {
    const filters = parseOrderFilters(new URLSearchParams('platform=shopify'));
    expect('platform' in filters).toBe(false);
  });
});
