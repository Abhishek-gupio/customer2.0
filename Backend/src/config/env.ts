import dotenv from "dotenv";
dotenv.config({ override: true });
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGIN: z.string().default("*"),
  /** Max requests per IP per 15 min. Increase if API docs / Try it out burns limit (e.g. 300). */
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  REDIS_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : v === "true")),
  /**
   * Synthesize cloud TTS for every assistant reply. Off by default and deliberately so: at
   * ~$16/1M characters this was the single largest line item in the AI bill — several times the
   * LLM spend — while the voice overlay uses on-device TTS and never reads `voiceUrl`, and the
   * chat screen falls back to on-device TTS whenever `voiceUrl` is absent. Turn on only if a
   * surface genuinely needs server-rendered audio.
   */
  CLOUD_TTS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  JWT_SECRET: z.string().min(1).default("dev-secret-change-in-production"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),
  ADMIN_JWT_EXPIRY: z.string().default("24h"),
  DEALER_JWT_EXPIRY: z.string().default("24h"),
  PARKING_EMPLOYEE_JWT_EXPIRY: z.string().default("24h"),
  WASH_PARTNER_JWT_EXPIRY: z.string().default("24h"),
  WASH_TECHNICIAN_JWT_EXPIRY: z.string().default("24h"),
  OTP_EXPIRY_SEC: z.coerce.number().default(300),
  OTP_RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(30),

  // Razorpay (Customer Payments)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // SMS Service
  SMS_SERVICE: z
    .enum(["MOCK", "GMAIL", "GUPIO", "TWILIO", "SMTP"])
    .default("MOCK"),
  FLASH49_USERNAME: z.string().optional(),
  FLASH49_PASSWORD: z.string().optional(),
  FLASH49_FROM: z.string().optional(),
  FLASH49_DLT_CONTENT_ID: z.string().optional(),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().optional().transform(v => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Storage
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // DigiLocker
  DIGILOCKER_CLIENT_ID: z.string().optional(),
  DIGILOCKER_CLIENT_SECRET: z.string().optional(),
  DIGILOCKER_REDIRECT_URI: z.string().optional(),

  // Storage (STORAGE_DRIVER: "local" | "s3" – switch anytime via env; fallback is local)
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
  /** When using local storage, base URL for returned file URLs (e.g. https://api.example.com). If unset, relative /uploads/... is returned. */
  PUBLIC_BASE_URL: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  // AI Features
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().default("gemini-2.5-flash-lite"),
  /** Model for voice expense parsing; use gemini-1.5-pro for best accuracy. */
  GEMINI_VOICE_MODEL: z.string().default("gemini-2.5-flash-lite"),
  /** Groq is tried first for plain-text AI calls (fast, small free-tier quota); falls back to Gemini when unset or on error. */
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),

  // Weather
  WEATHER_API_KEY: z.string().optional(),

  // Telematics
  TELEMATICS_DEFAULT_PROVIDER: z.enum(["damoov", "inhouse"]).default("damoov"),
  DAMOOV_WEBHOOK_SECRET: z.string().optional(),
  DAMOOV_INSTANCE_ID: z.string().optional(),
  DAMOOV_INSTANCE_KEY: z.string().optional(),
  DAMOOV_ADMIN_EMAIL: z.string().optional(),
  DAMOOV_ADMIN_PASSWORD: z.string().optional(),

  // Voice (Enhanced TTS)
  GOOGLE_CLOUD_TTS_KEY: z.string().optional(),

  // Google Sign-In (OAuth 2.0 Web client ID for server-side ID token verification)
  GOOGLE_CLIENT_ID: z.string().optional(),
  // Vehicle Verification API
  API_ID: z.string().optional(),
  API_KEY: z.string().optional(),
  TOKEN_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
