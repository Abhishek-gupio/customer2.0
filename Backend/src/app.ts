import compression from "compression";
import cors from "cors";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorMiddleware } from "./middlewares/error.middleware";
import { apiRoutes } from "./routes";
import { setupSwagger } from "./swagger";

const app = express();

app.use(helmet());

const corsOptions: cors.CorsOptions = {
  origin:
    env.CORS_ORIGIN === "*"
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
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
  const db = env.DATABASE_URL ? "ok" : "not_configured";
  const redis = (await import("./config/redis").then((m) => m.getRedis()))
    ? "ok"
    : "not_configured";
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    services: { database: db, redis },
  });
});

// Swagger setup
setupSwagger(app);

app.use("/api", apiRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorMiddleware);

export { app };
