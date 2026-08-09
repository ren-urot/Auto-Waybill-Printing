import { cn } from '@/lib/utils';
import { statusBadgeClasses, statusLabel } from '@/lib/orders/status';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        statusBadgeClasses(status),
        className
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
