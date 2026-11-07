const {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  jsonb,
  integer,
} = require("drizzle-orm/pg-core");
const times = () => ({
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  password: text("password"),
  firstName: text("firstName"),
  lastName: text("lastName"),
  isEmailVerified: boolean("isEmailVerified").default(false),
  isActive: boolean("isActive").default(true),
  role: text("role").default("USER"),
  provider: text("provider").default("LOCAL"),
  googleId: text("googleId"),
  avatar: text("avatar"),
  lastLoginAt: timestamp("lastLoginAt"),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  passwordResetToken: text("passwordResetToken"),
  passwordResetExpires: timestamp("passwordResetExpires"),
  emailVerificationToken: text("emailVerificationToken"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
const refreshTokens = pgTable("refresh_tokens", {
  id: text("id").primaryKey(),
  token: text("token"),
  userId: text("userId"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  isRevoked: boolean("isRevoked").default(false),
});
const owned = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
});
const accounts = pgTable("seller_accounts", {
  ...owned(),
  marketplace: text("marketplace"),
  name: text("name"),
  seller_id: text("seller_id"),
  business_name: text("business_name"),
  contact_email: text("contact_email"),
  address: text("address"),
  notes: text("notes"),
  status: text("status"),
  ...times(),
});
const skus = pgTable("global_skus", {
  ...owned(),
  sku: text("sku"),
  name: text("name"),
  category: text("category"),
  description: text("description"),
  notes: text("notes"),
  attributes: jsonb("attributes"),
  images: jsonb("images"),
  ...times(),
});
const mappings = pgTable("account_sku_mappings", {
  ...owned(),
  global_sku_id: uuid("global_sku_id"),
  account_id: uuid("account_id"),
  account_sku: text("account_sku"),
  marketplace_ref: text("marketplace_ref"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
const drafts = pgTable("listing_drafts", {
  ...owned(),
  name: text("name"),
  template_key: text("template_key"),
  data: jsonb("data"),
  revision: integer("revision").default(1),
  status: text("status").default("draft"),
  ...times(),
});
const exportsTable = pgTable("listing_exports", {
  ...owned(),
  draft_id: uuid("draft_id"),
  account_id: uuid("account_id"),
  batch_id: uuid("batch_id"),
  filename: text("filename"),
  template_key: text("template_key"),
  template_hash: text("template_hash"),
  snapshot: jsonb("snapshot"),
  file_base64: text("file_base64"),
  checksum: text("checksum"),
  row_count: integer("row_count"),
  size: integer("size"),
  status: text("status"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
const activity = pgTable("activity_logs", {
  ...owned(),
  action: text("action"),
  entity_type: text("entity_type"),
  entity_id: text("entity_id"),
  summary: text("summary"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
module.exports = {
  users,
  refreshTokens,
  accounts,
  skus,
  mappings,
  drafts,
  exportsTable,
  activity,
};
