import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../config/env.js';

// Prisma 7's generated client requires an explicit driver adapter rather than
// reading DATABASE_URL itself at runtime — env.js remains the single place
// that reads process.env.
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

// Single shared Prisma client instance for the whole process.
export const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});
