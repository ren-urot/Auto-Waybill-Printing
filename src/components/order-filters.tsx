'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ORDER_STATUSES, statusLabel } from '@/lib/orders/status';

const SORT_OPTIONS = ['newest', 'oldest', 'courier'] as const;

/** Sentinel for "no status filter" — the Select/Tabs can't use '' as an item value. */
const ALL_STATUSES = 'all';

const KEYWORD_DEBOUNCE_MS = 300;

export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      // replace, not push: filter changes are a view adjustment, not
      // navigation. router.push turned every keystroke into a back-button
      // entry.
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const keywordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (keywordTimer.current) clearTimeout(keywordTimer.current);
    },
    []
  );

  function handleKeywordChange(value: string) {
    if (keywordTimer.current) clearTimeout(keywordTimer.current);
    keywordTimer.current = setTimeout(() => updateParam('keyword', value), KEYWORD_DEBOUNCE_MS);
  }

  const activeStatus = searchParams.get('status') ?? ALL_STATUSES;

  return (
    <div className="space-y-3">
      <Tabs
        value={activeStatus}
        onValueChange={(v) => updateParam('status', !v || v === ALL_STATUSES ? '' : String(v))}
      >
        <TabsList>
          <TabsTrigger value={ALL_STATUSES}>All</TabsTrigger>
          {ORDER_STATUSES.map((status) => (
            <TabsTrigger key={status} value={status}>
              {statusLabel(status)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order #, customer, tracking number…"
            defaultValue={searchParams.get('keyword') ?? ''}
            onChange={(e) => handleKeywordChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select defaultValue={searchParams.get('sort') ?? 'newest'} onValueChange={(v) => updateParam('sort', v ?? '')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((sort) => (
              <SelectItem key={sort} value={sort} className="capitalize">
                {sort}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
