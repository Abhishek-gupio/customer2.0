import { Router } from "express";
import multer from "multer";
import { aiController } from "./ai.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Protect all AI routes
router.use(authMiddleware);

router.post("/coach", aiController.coach);
router.post("/voice/transcribe", upload.single("audio"), aiController.transcribe);
router.post("/voice/intent", upload.single("audio"), aiController.intent);

export const aiRoutes = router;
