import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string;
  delta?: { value: string; direction: 'up' | 'down' };
}

export function StatCard({ icon: Icon, iconClassName, label, value, delta }: StatCardProps) {
  return (
    <div className="rounded-[10px] bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]',
            iconClassName ?? 'bg-orange-50 text-primary dark:bg-orange-500/10'
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tracking-tight">{value}</span>
      </div>
      {delta && (
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium',
            delta.direction === 'up' ? 'text-green-600' : 'text-red-600'
          )}
        >
          {delta.direction === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {delta.value}
          <span className="font-normal text-muted-foreground">vs yesterday</span>
        </div>
      )}
    </div>
  );
}
