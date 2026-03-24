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

// Public routes for display/download
router.get("/:id/image", documentController.getImage);
router.get("/:id/pdf", documentController.getPDF);

// DigiLocker Public Testing (Moved to routes.ts for safety)


router.use(authMiddleware);

// Pre-upload quality check (documents + receipts)
router.post("/check-image-quality", upload.single("file"), documentController.checkImageQuality);

// Local Documents
router.post("/", upload.single("file"), documentController.upload);
router.get("/expiring", documentController.getExpiring);
router.get("/", documentController.list);
router.get("/:id", documentController.getById);
router.post("/:id/verify", documentController.verify);
router.delete("/:id", documentController.delete);

// DigiLocker (Session Protected)
router.get("/digilocker/connect", digilockerController.connect);
router.post("/digilocker/sync", digilockerController.sync);

export const documentRoutes = router;
