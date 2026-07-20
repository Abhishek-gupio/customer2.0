import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { agentController } from "./agent.controller";

const router = Router();

router.use(authMiddleware);
router.post("/message", agentController.message);
router.post("/message/stream", agentController.messageStream);

export const agentRoutes = router;
