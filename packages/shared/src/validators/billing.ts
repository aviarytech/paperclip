import { z } from "zod";

export const BILLING_PLANS = ["free", "team", "business", "enterprise"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  "inactive",
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLAN_CONFIG = {
  free: {
    label: "Free",
    priceCentsMonthly: 0,
    maxAgents: 2,
    maxSeats: 1,
    includedHeartbeats: 100,
    retentionDays: 7,
    features: ["basic_dashboard"],
  },
  team: {
    label: "Team",
    priceCentsMonthly: 50000,
    maxAgents: 10,
    maxSeats: 5,
    includedHeartbeats: 5000,
    retentionDays: 30,
    features: ["basic_dashboard", "sso", "audit_export", "notifications"],
  },
  business: {
    label: "Business",
    priceCentsMonthly: 200000,
    maxAgents: 50,
    maxSeats: 25,
    includedHeartbeats: 25000,
    retentionDays: 90,
    features: [
      "basic_dashboard",
      "sso",
      "audit_export",
      "notifications",
      "rbac",
      "custom_approvals",
      "webhooks",
      "billing_dashboards",
    ],
  },
  enterprise: {
    label: "Enterprise",
    priceCentsMonthly: 0, // custom pricing
    maxAgents: -1, // unlimited
    maxSeats: -1, // unlimited
    includedHeartbeats: -1, // unlimited
    retentionDays: 365,
    features: [
      "basic_dashboard",
      "sso",
      "audit_export",
      "notifications",
      "rbac",
      "custom_approvals",
      "webhooks",
      "billing_dashboards",
      "vpc",
      "compliance",
    ],
  },
} as const;

export const HEARTBEAT_OVERAGE_CENTS = 1; // $0.01 per heartbeat

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(["team", "business"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateCheckoutSession = z.infer<typeof createCheckoutSessionSchema>;

export const createBillingPortalSessionSchema = z.object({
  returnUrl: z.string().url(),
});

export type CreateBillingPortalSession = z.infer<typeof createBillingPortalSessionSchema>;
