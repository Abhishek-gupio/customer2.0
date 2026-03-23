import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { customerController } from "./customer.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for profile pic
});

router.use(authMiddleware);

router.get("/profile", customerController.getProfile);
router.get("/profile/stats", customerController.getProfileStats);
router.put("/profile", customerController.updateProfile);
router.post("/profile/picture", upload.single("file"), customerController.uploadProfilePicture);
router.post("/device", customerController.registerDevice);

export const customerRoutes = router;
