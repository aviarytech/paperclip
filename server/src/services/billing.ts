import Stripe from "stripe";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, subscriptions, usageRecords, heartbeatRuns } from "@paperclipai/db";
import {
  PLAN_CONFIG,
  HEARTBEAT_OVERAGE_CENTS,
  type BillingPlan,
  type SubscriptionStatus,
} from "@paperclipai/shared";
import { notFound, badRequest } from "../errors.js";

export interface BillingConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  teamPriceId?: string;
  businessPriceId?: string;
  heartbeatPriceId?: string;
}

export function billingService(db: Db, config: BillingConfig) {
  const stripe = new Stripe(config.stripeSecretKey);

  async function getSubscription(companyId: string) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId));
    return sub ?? null;
  }

  async function getOrCreateCustomer(companyId: string) {
    const existing = await getSubscription(companyId);
    if (existing) return existing;

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) throw notFound("Company not found");

    const customer = await stripe.customers.create({
      metadata: { companyId, companyName: company.name },
    });

    const [sub] = await db
      .insert(subscriptions)
      .values({
        companyId,
        stripeCustomerId: customer.id,
        plan: "free",
        status: "inactive",
      })
      .returning();

    return sub;
  }

  return {
    getStripe: () => stripe,

    getSubscription,

    getOrCreateCustomer,

    createCheckoutSession: async (
      companyId: string,
      plan: "team" | "business",
      successUrl: string,
      cancelUrl: string,
    ) => {
      const priceId =
        plan === "team" ? config.teamPriceId : config.businessPriceId;

      if (!priceId) {
        throw badRequest(`Stripe price ID not configured for ${plan} plan`);
      }

      const sub = await getOrCreateCustomer(companyId);

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        { price: priceId, quantity: 1 },
      ];

      if (config.heartbeatPriceId) {
        lineItems.push({ price: config.heartbeatPriceId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: sub.stripeCustomerId,
        mode: "subscription",
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { companyId, plan },
        subscription_data: {
          metadata: { companyId, plan },
        },
      });

      return { sessionId: session.id, url: session.url };
    },

    createBillingPortalSession: async (companyId: string, returnUrl: string) => {
      const sub = await getSubscription(companyId);
      if (!sub) throw notFound("No subscription found for this company");

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: returnUrl,
      });

      return { url: session.url };
    },

    getEntitlements: async (companyId: string) => {
      const sub = await getSubscription(companyId);
      const plan: BillingPlan = (sub?.plan as BillingPlan) ?? "free";
      const planConfig = PLAN_CONFIG[plan];

      return {
        plan,
        status: (sub?.status as SubscriptionStatus) ?? "inactive",
        maxAgents: planConfig.maxAgents,
        maxSeats: planConfig.maxSeats,
        includedHeartbeats: planConfig.includedHeartbeats,
        retentionDays: planConfig.retentionDays,
        features: [...planConfig.features],
      };
    },

    reportUsage: async (companyId: string, periodStart: Date, periodEnd: Date) => {
      const [result] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.startedAt, periodStart),
            lte(heartbeatRuns.startedAt, periodEnd),
          ),
        );

      const heartbeatCount = result?.count ?? 0;
      const sub = await getSubscription(companyId);
      const plan: BillingPlan = (sub?.plan as BillingPlan) ?? "free";
      const included = PLAN_CONFIG[plan].includedHeartbeats;
      const overage = included === -1 ? 0 : Math.max(0, heartbeatCount - included);
      const overageCents = overage * HEARTBEAT_OVERAGE_CENTS;

      const [record] = await db
        .insert(usageRecords)
        .values({
          companyId,
          periodStart,
          periodEnd,
          heartbeatCount,
          includedHeartbeats: included === -1 ? heartbeatCount : included,
          overageHeartbeats: overage,
          overageCents,
        })
        .returning();

      // Report overage to Stripe if applicable
      if (overage > 0 && sub?.stripeSubscriptionId && config.heartbeatPriceId) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          const meterItem = stripeSub.items.data.find(
            (item) => item.price.id === config.heartbeatPriceId,
          );

          if (meterItem) {
            const usageRecord = await stripe.subscriptionItems.createUsageRecord(
              meterItem.id,
              {
                quantity: overage,
                timestamp: Math.floor(periodEnd.getTime() / 1000),
                action: "set",
              },
            );

            await db
              .update(usageRecords)
              .set({
                stripeUsageRecordId: usageRecord.id,
                reportedToStripe: "true",
              })
              .where(eq(usageRecords.id, record.id));
          }
        } catch {
          // Usage reporting failure is non-fatal; will retry next period
        }
      }

      return record;
    },

    handleWebhookEvent: async (event: Stripe.Event) => {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const companyId = session.metadata?.companyId;
          const plan = session.metadata?.plan as BillingPlan | undefined;
          if (!companyId || !plan) break;

          await db
            .update(subscriptions)
            .set({
              stripeSubscriptionId: session.subscription as string,
              plan,
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.companyId, companyId));
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const companyId = subscription.metadata?.companyId;
          if (!companyId) break;

          const status = mapStripeStatus(subscription.status);
          const update: Record<string, unknown> = {
            status,
            stripePriceId: subscription.items.data[0]?.price.id ?? null,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end ? "true" : "false",
            updatedAt: new Date(),
          };

          if (subscription.trial_end) {
            update.trialEndsAt = new Date(subscription.trial_end * 1000);
          }

          await db
            .update(subscriptions)
            .set(update)
            .where(eq(subscriptions.companyId, companyId));
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const companyId = subscription.metadata?.companyId;
          if (!companyId) break;

          await db
            .update(subscriptions)
            .set({
              status: "canceled",
              plan: "free",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.companyId, companyId));
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string | null;
          if (!subId) break;

          await db
            .update(subscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, subId));
          break;
        }
      }
    },
  };
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    default:
      return "inactive";
  }
}
