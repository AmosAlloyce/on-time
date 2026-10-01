import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || "file:./dev.db" } },
});

try {
  await db.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await db.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
} catch (error) {
  console.warn("Could not set SQLite WAL pragma:", error);
} finally {
  await db.$disconnect();
}
