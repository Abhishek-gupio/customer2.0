import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { voiceActionController } from "./voice-action.controller";

const router = Router();

router.use(authMiddleware);

router.post("/:actionKey/preview", voiceActionController.preview);
router.post("/:actionKey/commit", voiceActionController.commit);

export const voiceActionRoutes = router;
