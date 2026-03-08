import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    heartbeatCount: integer("heartbeat_count").notNull().default(0),
    includedHeartbeats: integer("included_heartbeats").notNull().default(0),
    overageHeartbeats: integer("overage_heartbeats").notNull().default(0),
    overageCents: integer("overage_cents").notNull().default(0),
    stripeUsageRecordId: text("stripe_usage_record_id"),
    reportedToStripe: text("reported_to_stripe").notNull().default("false"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyPeriodIdx: index("usage_records_company_period_idx").on(
      table.companyId,
      table.periodStart,
    ),
  }),
);
