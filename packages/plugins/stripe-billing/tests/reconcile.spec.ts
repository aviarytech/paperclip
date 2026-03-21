import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReconcileHandler } from "../src/handlers/reconcile.js";
import { MAX_RETRY_ATTEMPTS } from "../src/constants.js";

describe("ReconcileHandler", () => {
  let mockStripe: any;
  let mockEntities: any;
  let mockLogger: any;
  let handler: ReturnType<typeof createReconcileHandler>;

  beforeEach(() => {
    mockStripe = { sendMeterEvent: vi.fn().mockResolvedValue(undefined) };
    mockEntities = {
      list: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    };
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    handler = createReconcileHandler(mockStripe, mockEntities, mockLogger);
  });

  it("retries failed meter events", async () => {
    mockEntities.list.mockResolvedValue([
      {
        id: "ent_1",
        externalId: "evt_1-input",
        scopeId: "comp_1",
        status: "pending",
        title: "Failed: evt_1-input",
        data: {
          costEventId: "evt_1",
          payload: { event_name: "llm_token_usage", identifier: "evt_1-input", timestamp: "2026-03-20T00:00:00Z", payload: { stripe_customer_id: "cus_123", value: "1000", model: "test", token_type: "input" } },
          attempts: 1,
          lastError: "timeout",
          failedAt: "2026-03-20T00:00:00Z",
        },
      },
    ]);

    await handler();

    expect(mockStripe.sendMeterEvent).toHaveBeenCalledTimes(1);
    expect(mockEntities.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "resolved" }),
    );
  });

  it("marks events as exhausted after max attempts", async () => {
    mockStripe.sendMeterEvent.mockRejectedValue(new Error("Still failing"));
    mockEntities.list.mockResolvedValue([
      {
        id: "ent_2",
        externalId: "evt_2-input",
        scopeId: "comp_1",
        status: "pending",
        title: "Failed: evt_2-input",
        data: {
          costEventId: "evt_2",
          payload: { event_name: "llm_token_usage", identifier: "evt_2-input", timestamp: "2026-03-20T00:00:00Z", payload: { stripe_customer_id: "cus_123", value: "1000", model: "test", token_type: "input" } },
          attempts: MAX_RETRY_ATTEMPTS - 1,
          lastError: "timeout",
          failedAt: "2026-03-20T00:00:00Z",
        },
      },
    ]);

    await handler();

    expect(mockEntities.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "exhausted" }),
    );
  });
});
