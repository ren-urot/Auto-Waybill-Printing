import type { OrderStatus } from '@/lib/shopify/merge';

export interface OrderFilters {
  // No `platform` filter: `orders` has no platform column (only `stores` does)
  // and phase 1 supports Shopify only, so parsing one produced a field the
  // query could never honour — false confidence, not a feature.
  courier?: string;
  status?: OrderStatus;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  sort: 'newest' | 'oldest' | 'courier';
}

const VALID_SORTS = ['newest', 'oldest', 'courier'] as const;

export function parseOrderFilters(searchParams: URLSearchParams): OrderFilters {
  const sortParam = searchParams.get('sort');
  const sort = (VALID_SORTS as readonly string[]).includes(sortParam ?? '')
    ? (sortParam as OrderFilters['sort'])
    : 'newest';

  return {
    courier: searchParams.get('courier') ?? undefined,
    status: (searchParams.get('status') as OrderStatus | null) ?? undefined,
    paymentMethod: searchParams.get('paymentMethod') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    keyword: searchParams.get('keyword')?.trim() || undefined,
    sort,
  };
}
