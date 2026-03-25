import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://inventory:inventory@localhost:5446/inventory";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
