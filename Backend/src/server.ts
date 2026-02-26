import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { notificationService } from "./services/notification.service";
import { initSocket } from "./socket";

// Initialize Background Tasks (Cron Jobs)
notificationService.initCronJobs();

if (env.REDIS_URL) {
  import("./services/scheduler.service")
    .then(({ schedulerService }) => schedulerService.init())
    .catch((err) => {
      logger.warn({ err }, "Scheduler init failed; continuing without BullMQ");
    });
} else {
  logger.warn("REDIS_URL not set; BullMQ scheduler/workers are disabled");
}

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    "Backend server listening with WebSockets",
  );
});
