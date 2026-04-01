const OTEL_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

interface SpanState {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  attributes?: Record<string, string | number | boolean>;
}

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toAnyValue(value: string | number | boolean) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { doubleValue: value };
  return { boolValue: value };
}

function toNano(date = Date.now()) {
  return `${BigInt(Math.floor(date)) * 1_000_000n}`;
}

export function newTraceparent() {
  return `00-${randomHex(16)}-${randomHex(8)}-01`;
}

export function startSpan(
  name: string,
  traceparent?: string,
  attributes?: Record<string, string | number | boolean>,
): SpanState {
  const parts = traceparent?.split("-") ?? [];
  const incomingTraceId = parts[1];
  const incomingSpanId = parts[2];

  return {
    traceId: incomingTraceId && incomingTraceId.length === 32 ? incomingTraceId : randomHex(16),
    spanId: randomHex(8),
    parentSpanId:
      incomingSpanId && incomingSpanId.length === 16 ? incomingSpanId : undefined,
    name,
    startTimeUnixNano: toNano(),
    attributes,
  };
}

export async function endSpan(span: SpanState, statusCode = 1) {
  const attributes = Object.entries(span.attributes ?? {}).map(([key, value]) => ({
    key,
    value: toAnyValue(value),
  }));

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "order-service" } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "suilens.native-otel" },
            spans: [
              {
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                name: span.name,
                kind: 1,
                startTimeUnixNano: span.startTimeUnixNano,
                endTimeUnixNano: toNano(),
                attributes,
                status: { code: statusCode },
              },
            ],
          },
        ],
      },
    ],
  };

  await fetch(`${OTEL_ENDPOINT}/v1/traces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
}
