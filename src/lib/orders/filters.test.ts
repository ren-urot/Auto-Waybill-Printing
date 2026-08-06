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

  it('parses dateFrom and dateTo', () => {
    const filters = parseOrderFilters(new URLSearchParams('dateFrom=2026-08-01&dateTo=2026-08-06'));
    expect(filters.dateFrom).toBe('2026-08-01');
    expect(filters.dateTo).toBe('2026-08-06');
  });
});
