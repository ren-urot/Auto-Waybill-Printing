import type { InferSelectModel } from 'drizzle-orm';
import { stores, orders, printHistory } from '@/db/schema';

// Static, fixed-ID demo dataset — used only when demo mode is explicitly
// set to "populated" (see src/lib/demo/mode.ts) and the real database has
// nothing to show (either genuinely empty, or unreachable from the current
// environment). IDs are deterministic so the orders list, order detail, and
// print history stay consistent with each other across requests.

type StoreRow = InferSelectModel<typeof stores>;
type OrderRow = InferSelectModel<typeof orders>;
type PrintHistoryRow = InferSelectModel<typeof printHistory>;

const SHOPIFY_STORE_ID = '00000000-0000-4000-8000-000000000001';
const TIKTOK_STORE_ID = '00000000-0000-4000-8000-000000000002';
const SHOPEE_STORE_ID = '00000000-0000-4000-8000-000000000003';

export const MOCK_STORES: StoreRow[] = [
  {
    id: SHOPIFY_STORE_ID,
    name: 'OmniShip Demo Store',
    platform: 'shopify',
    shopDomain: 'omniship-demo.myshopify.com',
    accessToken: 'demo',
    status: 'connected',
    lastSyncedAt: new Date(),
    lastError: null,
    createdAt: new Date(Date.now() - 30 * 86400000),
  },
  {
    id: TIKTOK_STORE_ID,
    name: 'OmniShip TikTok Shop',
    platform: 'tiktok',
    shopDomain: 'omniship-demo.tiktokshop.com',
    accessToken: 'demo',
    status: 'connected',
    lastSyncedAt: new Date(),
    lastError: null,
    createdAt: new Date(Date.now() - 20 * 86400000),
  },
  {
    id: SHOPEE_STORE_ID,
    name: 'OmniShip Shopee Store',
    platform: 'shopee',
    shopDomain: 'omniship-demo.shopee.ph',
    accessToken: 'demo',
    status: 'connected',
    lastSyncedAt: new Date(),
    lastError: null,
    createdAt: new Date(Date.now() - 10 * 86400000),
  },
];

const COURIERS = ['J&T Express', 'Ninja Van', 'LBC Express', 'Flash Express'];
const STATUSES: OrderRow['status'][] = ['pending', 'ready_to_ship', 'printed', 'packed', 'shipped', 'cancelled'];
const NAMES = [
  'Maria Santos', 'Juan Dela Cruz', 'Angela Reyes', 'Mark Villanueva', 'Kristine Bautista',
  'Paolo Mendoza', 'Bea Gonzales', 'Carlo Ramos', 'Nicole Torres', 'Jayson Aquino',
  'Camille Flores', 'Enzo Garcia', 'Trisha Lim', 'Miguel Castro', 'Andrea Cruz',
];
const CITIES = ['Quezon City, Metro Manila', 'Makati City, Metro Manila', 'Cebu City, Cebu', 'Davao City, Davao del Sur', 'Pasig City, Metro Manila'];
const PRODUCTS = [
  { name: 'Wireless Earbuds Pro', price: 899 },
  { name: 'Phone Case - Clear', price: 199 },
  { name: 'LED Ring Light 10"', price: 649 },
  { name: 'Portable Power Bank 20000mAh', price: 1099 },
  { name: 'USB-C Fast Charger 30W', price: 399 },
];

function uuidFor(n: number): string {
  return `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

const STORE_IDS = [SHOPIFY_STORE_ID, TIKTOK_STORE_ID, SHOPEE_STORE_ID];

export const MOCK_ORDERS: OrderRow[] = Array.from({ length: 24 }, (_, i) => {
  const status = pick(STATUSES, i);
  const daysAgo = i % 7;
  const createdAt = new Date(Date.now() - daysAgo * 86400000 - i * 3600000);
  const product = pick(PRODUCTS, i);

  return {
    id: uuidFor(i + 1),
    storeId: pick(STORE_IDS, i),
    platformOrderId: `${70000 + i}`,
    orderNumber: `#${70000 + i}`,
    customerName: pick(NAMES, i),
    phone: `09${String(100000000 + i * 7654321).slice(0, 9)}`,
    address: {
      address1: `${(i % 900) + 1} ${pick(['Rizal', 'Mabini', 'Bonifacio', 'Aguinaldo'], i)} St.`,
      city: pick(CITIES, i),
      province: pick(CITIES, i).split(', ')[1],
      zip: `${1000 + (i % 900)}`,
      country: 'Philippines',
    },
    items: [{ sku: `SKU-${i}`, title: product.name, quantity: (i % 2) + 1 }],
    // Every demo order carries a courier and tracking number — this is
    // synthetic demo data meant for showing the product to investors/
    // clients, not a simulation of every real-world order-lifecycle edge
    // case, so there's no value in showing gaps here.
    courier: pick(COURIERS, i),
    trackingNumber: `TRK${900000000 + i}`,
    shippingFee: String(45 + (i % 8) * 10),
    paymentMethod: i % 2 === 0 ? 'COD' : 'Prepaid',
    status,
    notes: null,
    rawPayload: null,
    syncedAt: createdAt,
    createdAt,
  };
});

export const MOCK_PRINT_HISTORY: PrintHistoryRow[] = [
  {
    id: uuidFor(101),
    orderIds: MOCK_ORDERS.filter((o) => o.status === 'printed' || o.status === 'shipped')
      .slice(0, 4)
      .map((o) => o.id),
    printedBy: 'demo@omniship.local',
    paperSize: '4x6',
    documentType: 'waybill',
    printedAt: new Date(Date.now() - 2 * 3600000),
  },
  {
    id: uuidFor(102),
    orderIds: MOCK_ORDERS.filter((o) => o.status === 'shipped')
      .slice(0, 2)
      .map((o) => o.id),
    printedBy: 'demo@omniship.local',
    paperSize: 'a6',
    documentType: 'waybill',
    printedAt: new Date(Date.now() - 26 * 3600000),
  },
];

export function mockOrderPlatform(order: OrderRow): string {
  return MOCK_STORES.find((s) => s.id === order.storeId)?.platform ?? 'shopify';
}

function countMock(storeId: string | undefined, status: string): number {
  return MOCK_ORDERS.filter((o) => o.status === status && (!storeId || o.storeId === storeId)).length;
}

interface MockOrderFilters {
  status?: string;
  courier?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  sort: 'newest' | 'oldest' | 'courier';
}

export function mockOrderRows(filters: MockOrderFilters) {
  let rows = MOCK_ORDERS.filter((o) => {
    if (filters.status && o.status !== filters.status) return false;
    if (filters.courier && o.courier !== filters.courier) return false;
    if (filters.paymentMethod && o.paymentMethod !== filters.paymentMethod) return false;
    if (filters.dateFrom && o.createdAt < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && o.createdAt > new Date(filters.dateTo)) return false;
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      if (!o.customerName.toLowerCase().includes(kw) && !o.orderNumber.toLowerCase().includes(kw)) return false;
    }
    return true;
  });

  rows = [...rows].sort((a, b) => {
    if (filters.sort === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
    if (filters.sort === 'courier') return (a.courier ?? '').localeCompare(b.courier ?? '');
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    courier: o.courier,
    status: o.status,
    trackingNumber: o.trackingNumber,
    createdAt: o.createdAt,
    platform: mockOrderPlatform(o),
  }));
}

export function mockOrderById(id: string): OrderRow | undefined {
  return MOCK_ORDERS.find((o) => o.id === id);
}

export function computeMockDashboardData() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = MOCK_ORDERS.filter((o) => o.createdAt >= todayStart).length;

  const storeSummaries = MOCK_STORES.map((store) => ({
    store,
    total: MOCK_ORDERS.filter((o) => o.storeId === store.id).length,
    ready: countMock(store.id, 'ready_to_ship'),
    printed: countMock(store.id, 'printed'),
    shipped: countMock(store.id, 'shipped'),
    cancelled: countMock(store.id, 'cancelled'),
  }));

  return {
    allStores: MOCK_STORES,
    todayOrders,
    readyToShip: countMock(undefined, 'ready_to_ship'),
    printed: countMock(undefined, 'printed'),
    shipped: countMock(undefined, 'shipped'),
    cancelled: countMock(undefined, 'cancelled'),
    storeSummaries,
    recentPrints: MOCK_PRINT_HISTORY,
  };
}
