import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  courier: string | null;
  status: string;
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead>Order #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Courier</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <input
                type="checkbox"
                aria-label={`Select order ${order.orderNumber}`}
                checked={selected.has(order.id)}
                onChange={() => toggle(order.id)}
              />
            </TableCell>
            <TableCell className="font-mono">
              <Link href={`/orders/${order.id}`}>{order.orderNumber}</Link>
            </TableCell>
            <TableCell>{order.customerName}</TableCell>
            <TableCell>{order.courier ?? '—'}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="capitalize">
                {order.status.replace('_', ' ')}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
