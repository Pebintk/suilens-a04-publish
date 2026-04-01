import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { lenses } from "./db/schema";
import { eq } from "drizzle-orm";
import { endSpan, startSpan } from "./otel-native";

const lensResponse = t.Object({
  id: t.String({ format: "uuid" }),
  modelName: t.String(),
  manufacturerName: t.String(),
  minFocalLength: t.Numeric(),
  maxFocalLength: t.Numeric(),
  maxAperture: t.String(),
  mountType: t.String(),
  dayPrice: t.String(),
  weekendPrice: t.String(),
  description: t.Nullable(t.String()),
});

const errorResponse = t.Object({
  error: t.String(),
});

function logEvent(payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "catalog-service",
      ...payload,
    }),
  );
}

function serializeLens(lens: typeof lenses.$inferSelect) {
  return {
    ...lens,
    maxAperture: String(lens.maxAperture),
    dayPrice: String(lens.dayPrice),
    weekendPrice: String(lens.weekendPrice),
  };
}

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "SuiLens Catalog Service API",
          version: "1.0.0",
          description: "Catalog endpoints for browsing SuiLens lenses.",
        },
        tags: [{ name: "Catalog", description: "Lens catalog operations" }],
      },
      path: "/docs",
    }),
  )
  .get(
    "/api/lenses",
    async ({ request }) => {
      const traceparent = request.headers.get("traceparent") ?? "";
      const span = startSpan("list_lenses", traceparent, {
        "http.method": "GET",
        "http.route": "/api/lenses",
      });
      const results = await db.select().from(lenses);
      await endSpan(span, 1);
      return results.map(serializeLens);
    },
    {
      detail: {
        tags: ["Catalog"],
        summary: "List lenses",
        description: "Returns all rentable lenses in the catalog.",
      },
      response: {
        200: t.Array(lensResponse),
      },
    },
  )
  .get(
    "/api/lenses/:id",
    async ({ params, status, request }) => {
      const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
      const traceparent = request.headers.get("traceparent") ?? "";
      const span = startSpan("get_lens_by_id", traceparent, {
        "http.method": "GET",
        "http.route": "/api/lenses/:id",
        "lens.id": params.id,
      });
      const results = await db
        .select()
        .from(lenses)
        .where(eq(lenses.id, params.id));
      if (!results[0]) {
        logEvent({
          level: "warn",
          endpoint: "/api/lenses/:id",
          method: "GET",
          status_code: 404,
          request_id: requestId,
          trace_id: traceparent.split("-")[1] ?? "",
          message: "Lens not found",
          lens_id: params.id,
        });
        await endSpan(span, 2);
        return status(404, { error: "Lens not found" });
      }
      await endSpan(span, 1);
      return serializeLens(results[0]);
    },
    {
      detail: {
        tags: ["Catalog"],
        summary: "Get lens by ID",
        description: "Returns a single lens from the catalog.",
      },
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: lensResponse,
        404: errorResponse,
      },
    },
  )
  .get(
    "/health",
    () => ({ status: "ok", service: "catalog-service" }),
    {
      detail: {
        tags: ["Catalog"],
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
  .listen(3001);

console.log(`Catalog Service running on port ${app.server?.port}`);
