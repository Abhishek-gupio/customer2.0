import { Router } from "express";
import { chatController } from "./chat.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

// Core Chat Endpoint (Start or Continue)
router.post("/", chatController.chat);

// History Management
router.get("/sessions", chatController.listSessions);
router.get("/sessions/:sessionId", chatController.getHistory);

export const chatRoutes = router;
