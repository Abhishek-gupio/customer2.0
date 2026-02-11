import path from 'path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Load .env from the prisma package directory so migrations work from any cwd
config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
