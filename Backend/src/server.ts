import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { notificationService } from "./services/notification.service";
import { schedulerService } from "./services/scheduler.service";
import { initSocket } from "./socket";

// Initialize Background Tasks (Cron Jobs)
notificationService.initCronJobs();
schedulerService.init();

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    "Backend server listening with WebSockets",
  );
});
