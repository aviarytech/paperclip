import { Router, raw } from "express";
import type { Db } from "@paperclipai/db";
import {
  createCheckoutSessionSchema,
  createBillingPortalSessionSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { billingService, logActivity, type BillingConfig } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function billingRoutes(db: Db, config: BillingConfig) {
  const router = Router();
  const billing = billingService(db, config);

  // Get subscription & entitlements for a company
  router.get("/companies/:companyId/billing/subscription", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const subscription = await billing.getSubscription(companyId);
    const entitlements = await billing.getEntitlements(companyId);

    res.json({ subscription, entitlements });
  });

  // Get entitlements only
  router.get("/companies/:companyId/billing/entitlements", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const entitlements = await billing.getEntitlements(companyId);
    res.json(entitlements);
  });

  // Create Stripe Checkout session
  router.post(
    "/companies/:companyId/billing/checkout",
    validate(createCheckoutSessionSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;

      const result = await billing.createCheckoutSession(
        companyId,
        req.body.plan,
        req.body.successUrl,
        req.body.cancelUrl,
      );

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "billing.checkout_created",
        entityType: "subscription",
        entityId: companyId,
        details: { plan: req.body.plan },
      });

      res.json(result);
    },
  );

  // Create Stripe Billing Portal session
  router.post(
    "/companies/:companyId/billing/portal",
    validate(createBillingPortalSessionSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;

      const result = await billing.createBillingPortalSession(companyId, req.body.returnUrl);
      res.json(result);
    },
  );

  return router;
}

export function billingWebhookRoute(db: Db, config: BillingConfig) {
  const router = Router();
  const billing = billingService(db, config);
  const stripe = billing.getStripe();

  // Stripe webhook — needs raw body for signature verification
  router.post("/webhooks/stripe", raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: import("stripe").Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
      return;
    }

    try {
      await billing.handleWebhookEvent(event);
    } catch (err) {
      console.error(`Stripe webhook processing failed for event ${event.id} (${event.type}):`, err);
      res.status(500).json({ error: "Webhook event processing failed" });
      return;
    }
    res.json({ received: true });
  });

  return router;
}
