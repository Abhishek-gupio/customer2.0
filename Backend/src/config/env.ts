import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  JWT_SECRET: z.string().min(1).default("dev-secret-change-in-production"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  OTP_EXPIRY_SEC: z.coerce.number().default(300),
  OTP_RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(60),

  // Storage
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // DigiLocker
  DIGILOCKER_CLIENT_ID: z.string().optional(),
  DIGILOCKER_CLIENT_SECRET: z.string().optional(),
  DIGILOCKER_REDIRECT_URI: z.string().optional(),

  // Storage
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
  // AI Features
  GEMINI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
