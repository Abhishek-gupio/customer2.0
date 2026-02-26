import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { documentController } from "./document.controller";
import { digilockerController } from "./digilocker.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 10MB
  },
});

// DigiLocker callback must be reachable after OAuth redirect without Bearer header.
router.get("/digilocker/callback", digilockerController.callback);

router.use(authMiddleware);

// Local Documents
router.post("/", upload.single("file"), documentController.upload);
router.get("/expiring", documentController.getExpiring);
router.get("/", documentController.list);
router.get("/:id", documentController.getById);
router.post("/:id/verify", documentController.verify);
router.delete("/:id", documentController.delete);

// DigiLocker
router.get("/digilocker/connect", digilockerController.connect);
router.post("/digilocker/sync", digilockerController.sync);

export const documentRoutes = router;
