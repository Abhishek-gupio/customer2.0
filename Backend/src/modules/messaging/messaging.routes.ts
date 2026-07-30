import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { messageSendLimiter } from "../../middlewares/messaging-rate-limit.middleware";
import { messagingController } from "./messaging.controller";
import { qrController } from "./qr.controller";
import { guestController } from "./guest.controller";
import "./messaging.socket"; // side-effect: registers the typing-indicator relay

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

// QR
router.get("/qr/my-token", qrController.getMyToken);
router.post("/qr/rotate", qrController.rotateToken);
router.get("/qr/resolve/:token", qrController.resolveToken);

// Conversations
router.post("/conversations", messagingController.createConversation);
router.get("/conversations", messagingController.listConversations);
router.get("/conversations/:id", messagingController.getConversation);
router.delete("/conversations/:id", messagingController.deleteConversation);
router.patch("/conversations/:id/status", messagingController.updateStatus);
router.post("/conversations/:id/read", messagingController.markRead);
router.post("/conversations/:id/delivered", messagingController.markDelivered);
router.post("/conversations/:id/report", messagingController.reportConversation);
router.post(
  "/conversations/:id/messages",
  messageSendLimiter,
  upload.array("photos", 5),
  messagingController.sendMessage,
);

// Messages
router.post("/messages/:messageId/reaction", messagingController.addReaction);
router.delete("/messages/:messageId", messagingController.deleteMessage);

// Block list
router.post("/block", messagingController.blockContact);
router.delete("/block/:customerId", messagingController.unblockContact);
router.get("/blocked", messagingController.listBlocked);

// Quick replies
router.get("/quick-replies", messagingController.listQuickReplies);

// Guest conversations (owner side — replying to someone who messaged via the web fallback)
router.get("/guest-conversations", guestController.ownerListConversations);
router.get("/guest-conversations/:id", guestController.ownerGetConversation);
router.delete("/guest-conversations/:id", guestController.ownerDelete);
router.post("/guest-conversations/:id/reply", guestController.ownerReply);
router.patch("/guest-conversations/:id/status", guestController.ownerUpdateStatus);

export const messagingRoutes = router;
