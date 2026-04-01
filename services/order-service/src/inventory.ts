const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || "http://localhost:3004";

interface InventoryReservationPayload {
  orderId: string;
  lensId: string;
  branchCode: string;
  quantity: number;
}

interface ObservabilityHeaders {
  requestId: string;
  traceparent: string;
}

interface InventoryErrorResponse {
  error?: string;
}

export async function reserveInventory(
  payload: InventoryReservationPayload,
  telemetry: ObservabilityHeaders,
): Promise<
  { ok: true } | { ok: false; status: 404 | 409 | 500; error: string }
> {
  const response = await fetch(
    `${INVENTORY_SERVICE_URL}/api/inventory/reserve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": telemetry.requestId,
        traceparent: telemetry.traceparent,
      },
      body: JSON.stringify(payload),
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 500,
      error: "Failed to reach inventory service",
    };
  }

  if (response.ok) {
    return { ok: true };
  }

  const errorBody = (await response.json().catch(() => null)) as
    | InventoryErrorResponse
    | null;

  return {
    ok: false,
    status: response.status === 404 ? 404 : response.status === 409 ? 409 : 500,
    error: errorBody?.error || "Failed to reserve inventory",
  };
}

export async function releaseInventory(orderId: string, telemetry: ObservabilityHeaders) {
  await fetch(`${INVENTORY_SERVICE_URL}/api/inventory/release`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": telemetry.requestId,
      traceparent: telemetry.traceparent,
    },

    body: JSON.stringify({ orderId }),
  }).catch(() => null);
}
