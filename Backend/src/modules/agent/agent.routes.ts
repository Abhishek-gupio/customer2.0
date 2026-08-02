import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { aiMessageLimiter } from "../../middlewares/ai-rate-limit.middleware";
import { agentController } from "./agent.controller";

const router = Router();

router.use(authMiddleware);
// Every turn here can spend money (LLM calls, plus paid third-party APIs via the flows), so both
// entrypoints are rate limited per customer — see ai-rate-limit.middleware.ts.
router.post("/message", aiMessageLimiter, agentController.message);
router.post("/message/stream", aiMessageLimiter, agentController.messageStream);

export const agentRoutes = router;
