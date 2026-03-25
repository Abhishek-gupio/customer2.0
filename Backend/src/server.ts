// Initializing telematics polling job...
import "dotenv/config";

import { createServer } from "http"; // Server entry point reload
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { notificationService } from "./services/notification.service";
import { schedulerService } from "./services/scheduler.service";
import { initSocket } from "./socket";
import "./config/firebase"; // Initialize Firebase Admin

// Initialize Background Tasks (Cron Jobs)
notificationService.initCronJobs();
void schedulerService
  .init()
  .catch((err) => logger.error({ err }, "Scheduler initialization failed"));

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, "0.0.0.0", () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, host: "0.0.0.0" },
    "Backend server listening with WebSockets",
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received");

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info("HTTP server closed");

    try {
      const { closeWorkers } = await import("./jobs/workers");
      const { closeRedis } = await import("./config/redis");
      const { disconnect } = await import("@repo/db-customer");

      // 1. Stop workers from taking new jobs
      await closeWorkers();

      // 2. Stop scheduler from adding new repeatable jobs
      await schedulerService.shutdown();

      // 3. Close Redis
      await closeRedis();

      // 4. Close DB Pool
      await disconnect();

      logger.info("Graceful shutdown complete. Bye! 👋");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown fails
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
