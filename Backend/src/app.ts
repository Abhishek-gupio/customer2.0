import compression from "compression";
import cors from "cors";
import express, { type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorMiddleware } from "./middlewares/error.middleware";
import { apiRoutes } from "./routes";
import { digilockerController } from "./modules/document/digilocker.controller";
import { setupSwagger } from "./swagger";

/** Rate limit key: per user when JWT present, else per IP. */
function rateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.decode(token) as { id?: string } | null;
      if (payload?.id) return payload.id;
    } catch {
      // malformed token; fall back to IP
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown")}`;
}

const app = express();

app.use(helmet());

const corsOptions: cors.CorsOptions = {
  origin:
    env.NODE_ENV === "development"
      ? "*"
      : env.CORS_ORIGIN === "*"
        ? "*"
        : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

// Static files for local storage fallback
app.use("/uploads", express.static(env.UPLOAD_DIR));

import { RedisStore } from "rate-limit-redis";
import { getRedis } from "./config/redis";

const redis = getRedis();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  store: redis 
    ? new RedisStore({
        // @ts-expect-error - ioredis type mismatch in rate-limit-redis
        sendCommand: (...args: string[]) => redis.call(...args),
      })
    : undefined,
  validate: { default: false },
  skip: (req) => {
    // Don't count health checks so load balancers don't burn the limit
    if (req.path === "/health" || req.path === "/health/detailed") return true;
    // Don't count API docs (Swagger UI + spec). Browsing /api-docs and "Try it out"
    // would otherwise burn the limit and then all API calls get 429.
    if (req.path.startsWith("/api-docs")) return true;
    return false;
  },
});
app.use(limiter);

app.use((req: Request, _res: Response, next) => {
  if (req.url !== "/health") {
    logger.info({ method: req.method, url: req.url }, "request");
  }
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

app.get("/health/detailed", async (_req: Request, res: Response) => {
  try {
    const db = env.DATABASE_URL ? "ok" : "not_configured";
    const redisModule = await import("./config/redis");
    const redis = (await redisModule.getRedis()) ? "ok" : "not_configured";
    
    // Test actual DB query
    const { dbInstances } = await import("@repo/db-customer");
    const customerCount = await dbInstances.customer.count();
    const vehicleCount = await dbInstances.customerVehicle.count();

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
      services: { 
        database: db, 
        redis,
        metrics: {
          customers: customerCount,
          vehicles: vehicleCount
        }
      },
      connection: {
        host: _req.get('host'),
        remoteAddress: _req.socket.remoteAddress
      }
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err.message,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Swagger setup
setupSwagger(app);

// Public DigiLocker Success Redirect (Must be before /api to bypass auth middleware)
app.get("/api/v1/documents/digilocker/success", digilockerController.handleSuccess);

app.use("/api", apiRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorMiddleware);

export { app };
