

// Initializing telematics polling job...
import "dotenv/config";

import { createServer } from "http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import "./config/firebase";

async function bootstrap() {
  const { initRedis } = await import("./config/redis");
  await initRedis();

  const [{ app }, { notificationService }, { schedulerService }, { initSocket }] =
    await Promise.all([
      import("./app"),
      import("./services/notification.service"),
      import("./services/scheduler.service"),
      import("./socket"),
    ]);

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

    httpServer.close(async () => {
      logger.info("HTTP server closed");

      try {
        const { closeWorkers } = await import("./jobs/workers");
        const { closeRedis } = await import("./config/redis");
        const { disconnect } = await import("@repo/db-customer");

        await closeWorkers();
        await schedulerService.shutdown();
        await closeRedis();
        await disconnect();

        logger.info("Graceful shutdown complete. Bye!");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

void bootstrap().catch((err) => {
  logger.error({ err }, "Backend bootstrap failed");
  process.exit(1);
});
