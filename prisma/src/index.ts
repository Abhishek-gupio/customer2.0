import { PrismaClient } from '../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  var prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL ?? '';
const adapter = new PrismaPg({ connectionString });
export const dbInstances = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') global.prisma = dbInstances;

export * from '../prisma/generated/prisma/client';
