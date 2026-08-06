import type { ShopifyOrder } from './client';

export type OrderStatus = 'pending' | 'ready_to_ship' | 'printed' | 'packed' | 'shipped' | 'cancelled';

const LOCAL_ADVANCED_STATUSES: OrderStatus[] = ['printed', 'packed'];

export interface ExistingOrder {
  // Plain string, not OrderStatus: this comes straight off the `orders.status`
  // Drizzle column, which is declared as `text()` (no pg enum) in the schema.
  status: string;
}

export interface NewOrderRow {
  storeId: string;
  platformOrderId: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  address: Record<string, unknown>;
  items: Array<{ sku: string | null; title: string; quantity: number }>;
  courier: string | null;
  trackingNumber: string | null;
  shippingFee: string | null;
  paymentMethod: string | null;
  status: OrderStatus;
  notes: string | null;
  rawPayload: ShopifyOrder;
}

function mapShopifyStatus(shopifyOrder: ShopifyOrder): OrderStatus {
  if (shopifyOrder.cancelled_at) return 'cancelled';
  if (shopifyOrder.fulfillment_status === 'fulfilled') return 'shipped';
  return 'ready_to_ship';
}

export function mergeOrderUpdate(
  existing: ExistingOrder | null,
  shopifyOrder: ShopifyOrder,
  storeId: string
): NewOrderRow {
  const derivedStatus = mapShopifyStatus(shopifyOrder);
  const derivedIsTerminal = derivedStatus === 'cancelled' || derivedStatus === 'shipped';
  const status: OrderStatus =
    existing && LOCAL_ADVANCED_STATUSES.includes(existing.status as OrderStatus) && !derivedIsTerminal
      ? (existing.status as OrderStatus)
      : derivedStatus;

  const fulfillment = shopifyOrder.fulfillments?.[0];
  const customerName = [shopifyOrder.customer?.first_name, shopifyOrder.customer?.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown customer';

  return {
    storeId,
    platformOrderId: String(shopifyOrder.id),
    orderNumber: String(shopifyOrder.order_number),
    customerName,
    phone: shopifyOrder.shipping_address?.phone ?? shopifyOrder.customer?.phone ?? null,
    address: shopifyOrder.shipping_address ?? {},
    items: shopifyOrder.line_items.map((item) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
    })),
    courier: fulfillment?.tracking_company ?? null,
    trackingNumber: fulfillment?.tracking_number ?? null,
    shippingFee: shopifyOrder.total_shipping_price_set?.shop_money?.amount ?? null,
    paymentMethod: shopifyOrder.payment_gateway_names?.[0] ?? null,
    status,
    notes: shopifyOrder.note,
    rawPayload: shopifyOrder,
  };
}
