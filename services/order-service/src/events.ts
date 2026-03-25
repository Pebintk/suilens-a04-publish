import amqplib from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'suilens.events';

let channel: amqplib.Channel | null = null;

async function getChannel(): Promise<amqplib.Channel> {
  if (channel) return channel;
  const connection = await amqplib.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  return channel;
}

export async function publishEvent(routingKey: string, payload: Record<string, any>) {
  const ch = await getChannel();
  const message = JSON.stringify({
    event: routingKey,
    timestamp: new Date().toISOString(),
    data: payload,
  });
  ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(message), {
    persistent: true,
    contentType: 'application/json',
  });
  console.log(`Published event: ${routingKey}`, payload);
}
