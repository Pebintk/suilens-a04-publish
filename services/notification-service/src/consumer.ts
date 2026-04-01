import amqplib from "amqplib";
import { db } from "./db";
import { notifications } from "./db/schema";
import { broadcastNotification } from "./realtime";
import { endSpan, startSpan } from "./otel-native";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const EXCHANGE_NAME = "suilens.events";
const QUEUE_NAME = "notification-service.order-events";

function logEvent(payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "notification-service",
      ...payload,
    }),
  );
}

export async function startConsumer() {
  let retries = 0;
  const maxRetries = 10;
  const retryDelay = 2000;

  while (retries < maxRetries) {
    try {
      const connection = await amqplib.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
      await channel.assertQueue(QUEUE_NAME, { durable: true });
      await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "order.*");

      console.log(`Notification Service listening on queue: ${QUEUE_NAME}`);

      channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;

        try {
          const event = JSON.parse(msg.content.toString());
          const requestId = event?.meta?.requestId ?? "unknown";
          const traceparent = event?.meta?.traceparent ?? "";
          const consumeSpan = startSpan("consume_order_event", traceparent, {
            "messaging.system": "rabbitmq",
            "messaging.destination": QUEUE_NAME,
            "messaging.operation": "process",
          });
          logEvent({
            level: "info",
            message: "Received event from RabbitMQ",
            event: event.event,
            request_id: requestId,
            trace_id: traceparent.split("-")[1] ?? "",
          });

          if (event.event === "order.placed") {
            const { orderId, customerName, customerEmail, lensName } =
              event.data;

            const [notification] = await db
              .insert(notifications)
              .values({
              orderId,
              type: "order_placed",
              recipient: customerEmail,
              message: `Hi ${customerName}, your rental order for ${lensName} has been placed successfully. Order ID: ${orderId}`,
              payload: event.data,
            })
              .returning();

            if (notification) {
              broadcastNotification({
                type: "notification.created",
                notification: {
                  id: notification.id,
                  orderId: notification.orderId,
                  event: event.event,
                  recipient: notification.recipient,
                  message: notification.message,
                  payload: notification.payload as {
                    orderId: string;
                    customerName: string;
                    customerEmail: string;
                    lensName: string;
                    branchCode?: string;
                    quantity?: number;
                  },
                  sentAt: notification.sentAt.toISOString(),
                },
              });

              console.log(`Notification recorded for order ${orderId}`);
              logEvent({
                level: "info",
                message: "Notification recorded",
                order_id: orderId,
                event: event.event,
                request_id: requestId,
                trace_id: traceparent.split("-")[1] ?? "",
              });
            }
          }

          await endSpan(consumeSpan, 1);

          channel.ack(msg);
        } catch (error) {
          console.error("Error processing message:", error);
          channel.nack(msg, false, true);
        }
      });

      return;
    } catch (error) {
      retries++;
      console.warn(
        `Failed to connect to RabbitMQ (attempt ${retries}/${maxRetries}):`,
        (error as Error).message,
      );
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error(
    "Failed to connect to RabbitMQ after maximum retries. Continuing without consumer.",
  );
}
