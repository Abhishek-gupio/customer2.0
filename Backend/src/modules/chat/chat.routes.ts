import { Router } from "express";
import multer from "multer";
import { chatController } from "./chat.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

// Core Chat Endpoints
router.post("/", upload.single("image"), chatController.chat);                 // Standard chat (with optional image)
router.post("/stream", upload.single("image"), chatController.streamChat);     // Feature 1: Streaming SSE

// History Management
router.get("/sessions", chatController.listSessions);
router.get("/sessions/:sessionId", chatController.getHistory);

// Feature 10: Analytics & Feedback
router.get("/analytics", chatController.getAnalytics);
router.post("/feedback", chatController.submitFeedback);

export const chatRoutes = router;
