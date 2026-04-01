

// Initializing telematics polling job...
import "dotenv/config";

import { createServer } from "http"; // Server entry point reload
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { notificationService } from "./services/notification.service";
import { schedulerService } from "./services/scheduler.service";
import { initSocket } from "./socket";

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
