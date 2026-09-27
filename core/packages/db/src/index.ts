import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

// Opening a connection to a remote Postgres (TLS + auth) costs several network round trips, so keep
// idle connections around instead of pg's 10s default; otherwise the first query after a short pause is slow.
const IDLE_CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;

// official Prisma 7 Postgres adapter
const adapter = new PrismaPg({
  connectionString,
  idleTimeoutMillis: IDLE_CONNECTION_TIMEOUT_MS,
  keepAlive: true,
});

const client = new PrismaClient({
  adapter,
});

export default client;
export { Prisma };
