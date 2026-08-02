import { Router } from "express";
import multer from "multer";
import { aiController } from "./ai.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { aiMessageLimiter } from "../../middlewares/ai-rate-limit.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Protect all AI routes
router.use(authMiddleware);

// Each of these spends on a paid model call (generation or transcription), so all three are rate
// limited per customer — see ai-rate-limit.middleware.ts.
router.post("/coach", aiMessageLimiter, aiController.coach);
router.post("/voice/transcribe", aiMessageLimiter, upload.single("audio"), aiController.transcribe);
router.post("/voice/intent", aiMessageLimiter, upload.single("audio"), aiController.intent);

export const aiRoutes = router;
