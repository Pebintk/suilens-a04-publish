import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const reservationStatusEnum = pgEnum("reservation_status", [
  "active",
  "released",
]);

export const branches = pgTable("branches", {
  code: varchar("code", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  address: text("address").notNull(),
});

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensId: uuid("lens_id").notNull(),
    branchCode: varchar("branch_code", { length: 50 })
      .references(() => branches.code)
      .notNull(),
    totalQuantity: integer("total_quantity").notNull(),
    availableQuantity: integer("available_quantity").notNull(),
  },
  (table) => ({
    lensBranchUnique: uniqueIndex("inventory_lens_branch_unique").on(
      table.lensId,
      table.branchCode,
    ),
  }),
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull(),
    lensId: uuid("lens_id").notNull(),
    branchCode: varchar("branch_code", { length: 50 })
      .references(() => branches.code)
      .notNull(),
    quantity: integer("quantity").notNull(),
    status: reservationStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    releasedAt: timestamp("released_at"),
  },
  (table) => ({
    orderUnique: uniqueIndex("reservations_order_unique").on(table.orderId),
  }),
);
