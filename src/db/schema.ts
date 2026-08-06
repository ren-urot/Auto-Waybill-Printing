import { pgTable, uuid, text, timestamp, jsonb, numeric, uniqueIndex } from 'drizzle-orm/pg-core';

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('shopify'),
    shopDomain: text('shop_domain').notNull(),
    accessToken: text('access_token').notNull(),
    status: text('status').notNull().default('connected'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stores_shop_domain_idx').on(table.shopDomain)]
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    platformOrderId: text('platform_order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    customerName: text('customer_name').notNull(),
    phone: text('phone'),
    address: jsonb('address').notNull(),
    items: jsonb('items').notNull(),
    courier: text('courier'),
    trackingNumber: text('tracking_number'),
    shippingFee: numeric('shipping_fee'),
    paymentMethod: text('payment_method'),
    status: text('status').notNull().default('pending'),
    notes: text('notes'),
    rawPayload: jsonb('raw_payload'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('orders_store_platform_order_idx').on(table.storeId, table.platformOrderId),
  ]
);

export const printHistory = pgTable('print_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderIds: jsonb('order_ids').notNull().$type<string[]>(),
  printedBy: text('printed_by').notNull(),
  paperSize: text('paper_size').notNull(),
  documentType: text('document_type').notNull(),
  printedAt: timestamp('printed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyName: text('company_name').notNull(),
  companyLogoUrl: text('company_logo_url'),
  companyAddress: text('company_address'),
  taxInfo: text('tax_info'),
  defaultPaperSize: text('default_paper_size').notNull().default('4x6'),
  defaultCourier: text('default_courier'),
});
