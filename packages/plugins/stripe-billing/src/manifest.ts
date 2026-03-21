import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { EXPORT_NAMES, JOB_KEYS, PAGE_ROUTE, PLUGIN_ID, PLUGIN_VERSION, SLOT_IDS, WEBHOOK_KEYS } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Stripe Token Billing",
  description: "Bill customers for LLM token usage via Stripe",
  author: "Paperclip",
  categories: ["connector"],
  capabilities: [
    "events.subscribe",
    "companies.read",
    "agents.read",
    "agents.pause",
    "agents.resume",
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "secrets.read-ref",
    "jobs.schedule",
    "activity.log.write",
    "webhooks.receive",
    "ui.page.register",
    "ui.dashboardWidget.register",
    "ui.detailTab.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      stripeSecretKey: {
        type: "string",
        title: "Stripe Secret Key (Secret Ref)",
      },
      stripeWebhookSecret: {
        type: "string",
        title: "Stripe Webhook Secret (Secret Ref)",
      },
      defaultMarkupPercent: {
        type: "number",
        title: "Default Markup %",
        default: 30,
      },
      autoSuspendOnPaymentFailure: {
        type: "boolean",
        title: "Auto-suspend on Payment Failure",
        default: true,
      },
      reconciliationSchedule: {
        type: "string",
        title: "Reconciliation Schedule (cron)",
        default: "0 2 * * *",
      },
    },
    required: ["stripeSecretKey", "stripeWebhookSecret"],
  },
  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.stripe,
      displayName: "Stripe Webhook",
      description: "Receives payment and invoice events from Stripe",
    },
  ],
  jobs: [
    {
      jobKey: JOB_KEYS.reconcile,
      displayName: "Reconcile Billing",
      description: "Daily reconciliation of meter events with Stripe",
      schedule: "0 2 * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: SLOT_IDS.billingPage,
        displayName: "Billing",
        exportName: EXPORT_NAMES.billingPage,
        routePath: PAGE_ROUTE,
      },
      {
        type: "dashboardWidget",
        id: SLOT_IDS.billingWidget,
        displayName: "Billing Summary",
        exportName: EXPORT_NAMES.billingWidget,
      },
      {
        type: "detailTab",
        id: SLOT_IDS.companyBillingTab,
        displayName: "Billing",
        exportName: EXPORT_NAMES.companyBillingTab,
        entityTypes: ["company"],
      },
    ],
  },
};

export default manifest;
