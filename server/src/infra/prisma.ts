import { PrismaClient } from '@prisma/client';
import { getLogger } from '../logger.js';

let client: PrismaClient | null = null;

/** Process-wide Prisma client for platform PostgreSQL (durable session and
 * identity authority). Created once at startup, disconnected on shutdown. */
export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export async function closePrisma(): Promise<void> {
  if (!client) return;
  try {
    await client.$disconnect();
  } catch (err) {
    getLogger().warn({ err }, 'prisma disconnect failed');
  } finally {
    client = null;
  }
}
