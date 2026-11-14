import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userPreferences = sqliteTable(
  "user_preferences",
  {
    userId: text("user_id").notNull(),
    preferenceKey: text("preference_key").notNull(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.preferenceKey] })],
);

export const productEntitlements = sqliteTable(
  "product_entitlements",
  {
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    grantedAt: text("granted_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

export const entitlementSources = sqliteTable("entitlement_sources", {
  sourceId: text("source_id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const accountDirectory = sqliteTable("account_directory", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  updatedAt: text("updated_at").notNull(),
});

export const trustedDevices = sqliteTable(
  "trusted_devices",
  {
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    label: text("label").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.deviceId] })],
);

export const activeListeningSessions = sqliteTable("active_listening_sessions", {
  userId: text("user_id").primaryKey(),
  deviceId: text("device_id").notNull(),
  trackId: text("track_id").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const paymentOrders = sqliteTable("payment_orders", {
  paymentId: text("payment_id").primaryKey(),
  email: text("email").notNull(),
  userId: text("user_id"),
  productId: text("product_id").notNull(),
  status: text("status").notNull(),
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
