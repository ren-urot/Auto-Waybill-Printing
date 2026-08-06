import type { OrderStatus } from '@/lib/shopify/merge';

export interface OrderFilters {
  platform?: string;
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
    platform: searchParams.get('platform') ?? undefined,
    courier: searchParams.get('courier') ?? undefined,
    status: (searchParams.get('status') as OrderStatus | null) ?? undefined,
    paymentMethod: searchParams.get('paymentMethod') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    keyword: searchParams.get('keyword')?.trim() || undefined,
    sort,
  };
}
