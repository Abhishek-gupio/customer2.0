

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

  /**
   * Ceiling on a single request. Node's default is 0 (no limit), which let an AI turn whose
   * upstream provider never answered hold a connection open indefinitely. Set above the longest
   * legitimate AI turn so normal traffic is unaffected. `requestTimeout` must stay below
   * `headersTimeout` for keep-alive connections to be reaped correctly.
   *
   * Socket.IO connections are long-lived by design and are unaffected — these apply to HTTP
   * request/response cycles, not upgraded WebSockets.
   */
  httpServer.requestTimeout = 120_000;
  httpServer.headersTimeout = 125_000;

  initSocket(httpServer);

  httpServer.listen(env.PORT, "0.0.0.0", () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, host: "0.0.0.0" },
      "Backend server listening with WebSockets",
    );
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, "Shutdown signal received");

    // Socket.IO keeps WebSocket connections open independently of the HTTP server's own
    // connection tracking — httpServer.close()'s callback only fires once every connection is
    // closed, and a live WebSocket (from the mobile app, or a lingering dev connection) never
    // closes on its own. Without this, shutdown silently hung for the full 10s force-timeout
    // below on every restart with an open socket, which is exactly why a quick nodemon
    // restart during dev kept hitting EADDRINUSE — the old process hadn't actually released
    // the port yet.
    try {
      const { getIO } = await import("./socket");
      getIO().close();
      logger.info("Socket.IO server closed");
    } catch (err) {
      logger.warn({ err }, "Socket.IO close skipped (not initialized or already closed)");
    }

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
