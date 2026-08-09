import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { PlatformIcon, type Platform } from '@/components/platform-icon';

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  courier: string | null;
  status: string;
  trackingNumber?: string | null;
  createdAt?: string;
  platform?: string | null;
}

interface OrderTableProps {
  orders: OrderRow[];
  selected: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function OrderTable({ orders, selected, onSelectionChange }: OrderTableProps) {
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function toggleAll() {
    if (selected.size === orders.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(orders.map((o) => o.id)));
    }
  }

  const allSelected = orders.length > 0 && selected.size === orders.length;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-16 text-center">
        <p className="text-sm font-medium">No orders match these filters</p>
        <p className="text-sm text-muted-foreground">Try a different status, keyword, or sync your store.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Select all orders"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-input"
              />
            </TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Courier</TableHead>
            <TableHead>Tracking #</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="group">
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Select order ${order.orderNumber}`}
                  checked={selected.has(order.id)}
                  onChange={() => toggle(order.id)}
                  className="h-4 w-4 rounded border-input"
                />
              </TableCell>
              <TableCell className="font-mono font-medium">
                <Link href={`/orders/${order.id}`} className="hover:text-primary hover:underline">
                  #{order.orderNumber}
                </Link>
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground capitalize">
                  <PlatformIcon platform={(order.platform ?? 'shopify') as Platform} className="h-3.5 w-3.5 shrink-0" />
                  {order.platform ?? 'Shopify'}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{order.courier ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {order.trackingNumber ?? '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge status={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
