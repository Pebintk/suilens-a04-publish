import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  message: text('message').notNull(),
  payload: jsonb('payload').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});
