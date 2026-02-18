/// <reference path="./types/global.d.ts" />
import "dotenv/config";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { notificationService } from "./services/notification.service";
import { schedulerService } from "./services/scheduler.service";

// Initialize Background Tasks (Cron Jobs)
notificationService.initCronJobs();
schedulerService.init();

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    "Backend server listening",
  );
});
