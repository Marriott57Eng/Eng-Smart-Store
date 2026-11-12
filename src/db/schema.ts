import { pgTable, text, doublePrecision, boolean, bigint } from 'drizzle-orm/pg-core';

// 1. Inventory Catalog
export const inventory = pgTable('inventory', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit').notNull(),
  qty: doublePrecision('qty').notNull().default(0),
  minStock: doublePrecision('min_stock').notNull().default(1),
  location: text('location').default(''),
  note: text('note').default(''),
  ordered: text('ordered').default(''),
  orderedDate: text('ordered_date').default(''),
  status: text('status').notNull().default('normal'), // 'normal' | 'low' | 'out'
  outOfStockDate: text('out_of_stock_date'),
  lastUpdated: text('last_updated'),
});

// 2. Requisition Transactions Log
export const requisitions = pgTable('requisitions', {
  id: text('id').primaryKey(),
  type: text('type').notNull().default('out'), // 'in' | 'out'
  itemId: text('item_id').notNull(),
  itemName: text('item_name').notNull(),
  category: text('category').default(''),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  requestedBy: text('requested_by').notNull(),
  purpose: text('purpose').default(''),
  timestamp: text('timestamp').notNull(),
  isoDate: text('iso_date').notNull(),
  note: text('note').default(''),
});

// 3. Purchase Orders
export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  itemName: text('item_name').notNull(),
  category: text('category').default(''),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  currentQty: doublePrecision('current_qty'),
  minStock: doublePrecision('min_stock'),
  location: text('location').default(''),
  requestedBy: text('requested_by').notNull(),
  brand: text('brand').default(''),
  model: text('model').default(''),
  supplier: text('supplier').default(''),
  note: text('note').default(''),
  urgency: text('urgency').default('normal'), // 'normal' | 'urgent' | 'critical'
  status: text('status').default('pending'), // 'pending' | 'confirmed' | 'received' | 'cancelled'
  createdAt: text('created_at').notNull(),
  isoDate: text('iso_date').notNull(),
  confirmedAt: text('confirmed_at'),
  confirmedBy: text('confirmed_by'),
  receivedAt: text('received_at'),
  receivedBy: text('received_by'),
  confirmationToken: text('confirmation_token'),
  confirmationTokenUsed: boolean('confirmation_token_used').default(false),
  isLocked: boolean('is_locked').default(false),
});

// 4. User Profiles & Sessions
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password'),
  name: text('name').notNull(),
  nickname: text('nickname').default(''),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  createdAt: text('created_at'),
  sessionToken: text('session_token'),
  activeDeviceId: text('active_device_id'),
  lastActiveAt: bigint('last_active_at', { mode: 'number' }),
});

// 5. System Central Settings (LINE, WebPush, Geo Fencing)
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON payload string
  updatedAt: text('updated_at'),
  updatedBy: text('updated_by'),
});

// 6. Push Notification Subscriptions
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userId: text('user_id'),
  userName: text('user_name'),
  deviceInfo: text('device_info'),
  subscribedAt: text('subscribed_at').notNull(),
});
