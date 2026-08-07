'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = ['pending', 'ready_to_ship', 'printed', 'packed', 'shipped', 'cancelled'];
const SORT_OPTIONS = ['newest', 'oldest', 'courier'];

/**
 * Sentinel for "no status filter". The Select can't use '' as an item value,
 * so clearing the filter needs its own option — without one, picking any
 * status was a one-way door back to hand-editing the URL.
 */
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

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <Input
        placeholder="Search order # or customer"
        defaultValue={searchParams.get('keyword') ?? ''}
        onChange={(e) => handleKeywordChange(e.target.value)}
        className="max-w-xs"
      />
      <Select
        defaultValue={searchParams.get('status') ?? ALL_STATUSES}
        onValueChange={(v) => updateParam('status', !v || v === ALL_STATUSES ? '' : v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {status.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select defaultValue={searchParams.get('sort') ?? 'newest'} onValueChange={(v) => updateParam('sort', v ?? '')}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {sort}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
