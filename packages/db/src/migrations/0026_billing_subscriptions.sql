CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") UNIQUE,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "plan" text NOT NULL DEFAULT 'free',
  "status" text NOT NULL DEFAULT 'inactive',
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" text NOT NULL DEFAULT 'false',
  "trial_ends_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscriptions_company_idx" ON "subscriptions" ("company_id");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_customer_idx" ON "subscriptions" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_idx" ON "subscriptions" ("stripe_subscription_id");

CREATE TABLE IF NOT EXISTS "usage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "heartbeat_count" integer NOT NULL DEFAULT 0,
  "included_heartbeats" integer NOT NULL DEFAULT 0,
  "overage_heartbeats" integer NOT NULL DEFAULT 0,
  "overage_cents" integer NOT NULL DEFAULT 0,
  "stripe_usage_record_id" text,
  "reported_to_stripe" text NOT NULL DEFAULT 'false',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "usage_records_company_period_idx" ON "usage_records" ("company_id", "period_start");
