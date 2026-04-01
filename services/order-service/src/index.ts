import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { orders } from "./db/schema";
import { eq } from "drizzle-orm";
import { publishEvent } from "./events";
import { releaseInventory, reserveInventory } from "./inventory";
import { endSpan, newTraceparent, startSpan } from "./otel-native";

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL || "http://localhost:3001";
const DEFAULT_BRANCH_CODE = process.env.DEFAULT_BRANCH_CODE || "KB-JKT-S";

interface CatalogLens {
  id: string;
  modelName: string;
  manufacturerName: string;
  dayPrice: string;
}

const orderLensSnapshot = t.Object({
  modelName: t.String(),
  manufacturerName: t.String(),
  dayPrice: t.String(),
});

const orderResponse = t.Object({
  id: t.String({ format: "uuid" }),
  customerName: t.String(),
  customerEmail: t.String({ format: "email" }),
  lensId: t.String({ format: "uuid" }),
  branchCode: t.String(),
  quantity: t.Numeric(),
  lensSnapshot: orderLensSnapshot,
  startDate: t.String(),
  endDate: t.String(),
  totalPrice: t.String(),
  status: t.String(),
  createdAt: t.String(),
});

const errorResponse = t.Object({
  error: t.String(),
});

const requestCounters = new Map<string, number>();
const errorCounters = new Map<string, number>();
const latencyBuckets = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const latencyBucketCounters = new Map<string, number>();
const orderBusinessCounters = new Map<string, number>();

function incMetric(map: Map<string, number>, key: string, step = 1) {
  map.set(key, (map.get(key) ?? 0) + step);
}

function logEvent(payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "order-service",
      ...payload,
    }),
  );
}

function observeHttp(route: string, statusCode: number, durationSeconds: number) {
  incMetric(requestCounters, route);
  if (statusCode >= 500) {
    incMetric(errorCounters, route);
  }

  for (const le of latencyBuckets) {
    if (durationSeconds <= le) {
      incMetric(latencyBucketCounters, `${route}:${le}`);
    }
  }
  incMetric(latencyBucketCounters, `${route}:+Inf`);
}

function renderPrometheusMetrics() {
  const lines: string[] = [];
  lines.push("# HELP suilens_http_requests_total Total HTTP requests by route");
  lines.push("# TYPE suilens_http_requests_total counter");
  for (const [route, count] of requestCounters) {
    lines.push(`suilens_http_requests_total{service=\"order-service\",route=\"${route}\"} ${count}`);
  }

  lines.push("# HELP suilens_http_errors_total Total HTTP 5xx errors by route");
  lines.push("# TYPE suilens_http_errors_total counter");
  for (const [route, count] of errorCounters) {
    lines.push(`suilens_http_errors_total{service=\"order-service\",route=\"${route}\"} ${count}`);
  }

  lines.push("# HELP suilens_http_request_duration_seconds_bucket HTTP request latency buckets");
  lines.push("# TYPE suilens_http_request_duration_seconds_bucket counter");
  for (const [bucketKey, count] of latencyBucketCounters) {
    const [route, le] = bucketKey.split(":");
    lines.push(
      `suilens_http_request_duration_seconds_bucket{service=\"order-service\",route=\"${route}\",le=\"${le}\"} ${count}`,
    );
  }

  lines.push("# HELP orders_created_total Business metric: order create outcomes");
  lines.push("# TYPE orders_created_total counter");
  for (const [status, count] of orderBusinessCounters) {
    lines.push(`orders_created_total{service=\"order-service\",status=\"${status}\"} ${count}`);
  }

  return `${lines.join("\n")}\n`;
}

function serializeOrder(order: typeof orders.$inferSelect) {
  return {
    ...order,
    lensSnapshot: order.lensSnapshot as {
      modelName: string;
      manufacturerName: string;
      dayPrice: string;
    },
    startDate: order.startDate.toISOString(),
    endDate: order.endDate.toISOString(),
    createdAt: order.createdAt.toISOString(),
  };
}

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "SuiLens Order Service API",
          version: "1.0.0",
          description: "Order creation and lookup endpoints for SuiLens.",
        },
        tags: [{ name: "Orders", description: "Rental order operations" }],
      },
      path: "/docs",
    }),
  )
  .post(
    "/api/orders",
    async ({ body, status, request }) => {
      const started = performance.now();
      const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
      const traceparent = request.headers.get("traceparent") ?? newTraceparent();
      const createOrderSpan = startSpan("create_order", traceparent, {
        "http.method": "POST",
        "http.route": "/api/orders",
        "enduser.id": body.customerEmail,
      });

      const lensResponse = await fetch(
        `${CATALOG_SERVICE_URL}/api/lenses/${body.lensId}`,
        {
          headers: {
            "x-request-id": requestId,
            traceparent,
          },
        },
      );
      if (!lensResponse.ok) {
        const durationSeconds = (performance.now() - started) / 1000;
        observeHttp("/api/orders", 404, durationSeconds);
        incMetric(orderBusinessCounters, "failed");
        logEvent({
          level: "warn",
          endpoint: "/api/orders",
          method: "POST",
          status_code: 404,
          request_id: requestId,
          trace_id: traceparent.split("-")[1] ?? "",
          message: "Lens not found while creating order",
          lens_id: body.lensId,
        });
        await endSpan(createOrderSpan, 2);
        return status(404, { error: "Lens not found" });
      }
      const lens = (await lensResponse.json()) as CatalogLens;

      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 0) {
        const durationSeconds = (performance.now() - started) / 1000;
        observeHttp("/api/orders", 400, durationSeconds);
        incMetric(orderBusinessCounters, "failed");
        await endSpan(createOrderSpan, 2);
        return status(400, { error: "End date must be after start date" });
      }
      const totalPrice = (days * parseFloat(lens.dayPrice)).toFixed(2);
      const branchCode = body.branchCode || DEFAULT_BRANCH_CODE;
      const quantity = 1;
      const orderId = crypto.randomUUID();

      const reservation = await reserveInventory({
        orderId,
        lensId: body.lensId,
        branchCode,
        quantity,
      }, { requestId, traceparent });

      if (!reservation.ok) {
        const durationSeconds = (performance.now() - started) / 1000;
        observeHttp("/api/orders", reservation.status, durationSeconds);
        incMetric(orderBusinessCounters, "failed");
        await endSpan(createOrderSpan, 2);
        return status(reservation.status, { error: reservation.error });
      }

      const [order] = await db
        .insert(orders)
        .values({
          id: orderId,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          lensId: body.lensId,
          branchCode,
          quantity,
          lensSnapshot: {
            modelName: lens.modelName,
            manufacturerName: lens.manufacturerName,
            dayPrice: lens.dayPrice,
          },
          startDate: start,
          endDate: end,
          totalPrice,
        })
        .returning();
      if (!order) {
        await releaseInventory(orderId, { requestId, traceparent });
        const durationSeconds = (performance.now() - started) / 1000;
        observeHttp("/api/orders", 500, durationSeconds);
        incMetric(orderBusinessCounters, "failed");
        await endSpan(createOrderSpan, 2);
        return status(500, { error: "Failed to create order" });
      }

      await publishEvent("order.placed", {
        orderId: order.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        lensName: lens.modelName,
        branchCode,
        quantity,
      }, { requestId, traceparent });

      const durationSeconds = (performance.now() - started) / 1000;
      observeHttp("/api/orders", 201, durationSeconds);
      incMetric(orderBusinessCounters, "success");
      logEvent({
        level: "info",
        endpoint: "/api/orders",
        method: "POST",
        status_code: 201,
        request_id: requestId,
        trace_id: traceparent.split("-")[1] ?? "",
        message: "Order created successfully",
        order_id: order.id,
        lens_id: body.lensId,
        branch_code: branchCode,
      });
      await endSpan(createOrderSpan, 1);

      return status(201, serializeOrder(order));
    },
    {
      detail: {
        tags: ["Orders"],
        summary: "Create order",
        description:
          "Creates a rental order after validating the requested lens against the catalog service.",
      },
      body: t.Object({
        customerName: t.String(),
        customerEmail: t.String({ format: "email" }),
        lensId: t.String({ format: "uuid" }),
        branchCode: t.Optional(t.String()),
        startDate: t.String(),
        endDate: t.String(),
      }),
      response: {
        201: orderResponse,
        400: errorResponse,
        404: errorResponse,
        409: errorResponse,
        500: errorResponse,
      },
    },
  )
  .get(
    "/api/orders",
    async () => {
      const started = performance.now();
      const results = await db.select().from(orders);
      observeHttp("/api/orders", 200, (performance.now() - started) / 1000);
      return results.map(serializeOrder);
    },
    {
      detail: {
        tags: ["Orders"],
        summary: "List orders",
      },
      response: {
        200: t.Array(orderResponse),
      },
    },
  )
  .get(
    "/api/orders/:id",
    async ({ params, status }) => {
      const started = performance.now();
      const results = await db
        .select()
        .from(orders)
        .where(eq(orders.id, params.id));
      if (!results[0]) {
        observeHttp("/api/orders/:id", 404, (performance.now() - started) / 1000);
        return status(404, { error: "Order not found" });
      }
      observeHttp("/api/orders/:id", 200, (performance.now() - started) / 1000);
      return serializeOrder(results[0]);
    },
    {
      detail: {
        tags: ["Orders"],
        summary: "Get order by ID",
      },
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: orderResponse,
        404: errorResponse,
      },
    },
  )
  .get(
    "/metrics",
    ({ set }) => {
      set.headers["content-type"] = "text/plain; version=0.0.4";
      return renderPrometheusMetrics();
    },
    {
      detail: {
        tags: ["Orders"],
        summary: "Prometheus metrics",
      },
      response: {
        200: t.String(),
      },
    },
  )
  .get(
    "/health",
    () => ({ status: "ok", service: "order-service" }),
    {
      detail: {
        tags: ["Orders"],
        summary: "Health check",
      },
      response: {
        200: t.Object({
          status: t.String(),
          service: t.String(),
        }),
      },
    },
  )
  .listen(3002);

console.log(`Order Service running on port ${app.server?.port}`);
