import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

// official Prisma 7 Postgres adapter
const adapter = new PrismaPg({
  connectionString,
});

const client = new PrismaClient({
  adapter,
});

export default client;
export { Prisma };
