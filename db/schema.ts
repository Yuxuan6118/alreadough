import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userSpaces = sqliteTable("user_spaces", {
  userId: text("user_id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const betaUsers = sqliteTable("beta_users", {
  userId: text("user_id").primaryKey(), startedAt: text("started_at").notNull(), expiresAt: text("expires_at").notNull(),
  totalRequests: integer("total_requests").notNull().default(0), totalTokens: integer("total_tokens").notNull().default(0), active: integer("active").notNull().default(1), lastSeenAt: text("last_seen_at").notNull(),
});

export const betaUsageDaily = sqliteTable("beta_usage_daily", {
  userId: text("user_id").notNull(), usageDate: text("usage_date").notNull(), requestCount: integer("request_count").notNull().default(0), chatRequests: integer("chat_requests").notNull().default(0), revisionRequests: integer("revision_requests").notNull().default(0), storyRequests: integer("story_requests").notNull().default(0), inputTokens: integer("input_tokens").notNull().default(0), outputTokens: integer("output_tokens").notNull().default(0), totalTokens: integer("total_tokens").notNull().default(0), failedRequests: integer("failed_requests").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.usageDate] })]);

export const betaGlobalDaily = sqliteTable("beta_global_daily", {
  usageDate: text("usage_date").primaryKey(), requestCount: integer("request_count").notNull().default(0), totalTokens: integer("total_tokens").notNull().default(0), failedRequests: integer("failed_requests").notNull().default(0), updatedAt: text("updated_at").notNull(),
});

export const betaEvents = sqliteTable("beta_events", {
  id: text("id").primaryKey(), userHash: text("user_hash").notNull(), eventType: text("event_type").notNull(), mode: text("mode"), wishCategory: text("wish_category"), coachMode: text("coach_mode"), promptVersion: text("prompt_version"), feedback: text("feedback"), ratingBefore: integer("rating_before"), ratingAfter: integer("rating_after"), inputTokens: integer("input_tokens").notNull().default(0), outputTokens: integer("output_tokens").notNull().default(0), totalTokens: integer("total_tokens").notNull().default(0), latencyMs: integer("latency_ms").notNull().default(0), createdAt: text("created_at").notNull(),
}, (table) => [index("beta_events_created_idx").on(table.createdAt), index("beta_events_user_idx").on(table.userHash, table.createdAt)]);

export const betaSettings = sqliteTable("beta_settings", {
  key: text("key").primaryKey(), value: text("value").notNull(), updatedAt: text("updated_at").notNull(),
});

export const betaRequestReservations = sqliteTable("beta_request_reservations", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), userHash: text("user_hash").notNull(),
  usageDate: text("usage_date").notNull(), mode: text("mode").notNull(), status: text("status").notNull().default("reserved"),
  createdAt: text("created_at").notNull(), settledAt: text("settled_at"),
}, (table) => [index("beta_reservations_user_idx").on(table.userId, table.createdAt)]);
