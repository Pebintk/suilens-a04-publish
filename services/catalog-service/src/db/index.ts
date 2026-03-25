import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://catalog:catalog@localhost:5443/catalog";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
