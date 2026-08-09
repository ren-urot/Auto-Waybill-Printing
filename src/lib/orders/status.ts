export const ORDER_STATUSES = ['pending', 'ready_to_ship', 'printed', 'packed', 'shipped', 'cancelled'] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatusValue, string> = {
  pending: 'Pending',
  ready_to_ship: 'Ready to Print',
  printed: 'Printed',
  packed: 'Packed',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

export const STATUS_BADGE_CLASSES: Record<OrderStatusValue, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/20',
  ready_to_ship:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  printed:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
  packed: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20',
  shipped:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20',
  cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatusValue] ?? status.replace(/_/g, ' ');
}

export function statusBadgeClasses(status: string): string {
  return (
    STATUS_BADGE_CLASSES[status as OrderStatusValue] ??
    'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/20'
  );
}
