import type { PluginEntitiesClient, PluginLogger } from "@paperclipai/plugin-sdk";
import { ENTITY_TYPES, MAX_RETRY_ATTEMPTS } from "../constants.js";
import type { StripeService } from "../services/stripe.js";
import type { FailedMeterEventData } from "../types.js";

export function createReconcileHandler(
  stripe: StripeService,
  entities: PluginEntitiesClient,
  logger: PluginLogger,
) {
  return async function handleReconcile(): Promise<void> {
    const allFailed = await entities.list({
      entityType: ENTITY_TYPES.failedMeterEvent,
      scopeKind: "company",
      limit: 100,
    });
    const failedEvents = allFailed.filter((e) => e.status === "pending");

    logger.info(`Reconciliation: ${failedEvents.length} pending failed events`);

    let retried = 0;
    let succeeded = 0;
    let exhausted = 0;

    for (const event of failedEvents) {
      const data = event.data as FailedMeterEventData;
      retried++;

      try {
        await stripe.sendMeterEvent(data.payload);
        await entities.upsert({
          entityType: ENTITY_TYPES.failedMeterEvent,
          externalId: event.externalId!,
          scopeKind: "company",
          scopeId: event.scopeId!,
          status: "resolved",
          title: event.title!,
          data,
        });
        succeeded++;
      } catch (err) {
        const attempts = data.attempts + 1;
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          await entities.upsert({
            entityType: ENTITY_TYPES.failedMeterEvent,
            externalId: event.externalId!,
            scopeKind: "company",
            scopeId: event.scopeId!,
            status: "exhausted",
            title: event.title!,
            data: {
              ...data,
              attempts,
              lastError: err instanceof Error ? err.message : String(err),
            },
          });
          exhausted++;
          logger.error(`Meter event ${event.externalId} exhausted after ${attempts} attempts`);
        } else {
          await entities.upsert({
            entityType: ENTITY_TYPES.failedMeterEvent,
            externalId: event.externalId!,
            scopeKind: "company",
            scopeId: event.scopeId!,
            status: "pending",
            title: event.title!,
            data: {
              ...data,
              attempts,
              lastError: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }

    logger.info(`Reconciliation complete: ${retried} retried, ${succeeded} succeeded, ${exhausted} exhausted`);
  };
}
