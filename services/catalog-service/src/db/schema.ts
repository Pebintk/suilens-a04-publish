import { pgTable, uuid, varchar, integer, numeric, text } from 'drizzle-orm/pg-core';

export const lenses = pgTable('lenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelName: varchar('model_name', { length: 255 }).notNull(),
  manufacturerName: varchar('manufacturer_name', { length: 255 }).notNull(),
  minFocalLength: integer('min_focal_length').notNull(),
  maxFocalLength: integer('max_focal_length').notNull(),
  maxAperture: numeric('max_aperture', { precision: 4, scale: 1 }).notNull(),
  mountType: varchar('mount_type', { length: 50 }).notNull(),
  dayPrice: numeric('day_price', { precision: 12, scale: 2 }).notNull(),
  weekendPrice: numeric('weekend_price', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
});
