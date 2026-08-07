'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = ['pending', 'ready_to_ship', 'printed', 'packed', 'shipped', 'cancelled'];
const SORT_OPTIONS = ['newest', 'oldest', 'courier'];

export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <Input
        placeholder="Search order # or customer"
        defaultValue={searchParams.get('keyword') ?? ''}
        onChange={(e) => updateParam('keyword', e.target.value)}
        className="max-w-xs"
      />
      <Select defaultValue={searchParams.get('status') ?? ''} onValueChange={(v) => updateParam('status', v ?? '')}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
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
