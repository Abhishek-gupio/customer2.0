import "dotenv/config";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "Backend server listening");
});
