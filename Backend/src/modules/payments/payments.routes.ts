import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { paymentsController } from "./payments.controller";
import { razorpayWebhookController } from "./razorpay.webhook.controller";

const router = Router();

// No authMiddleware: Razorpay-only, verified by signature in the controller.
// Must be registered before `router.use(authMiddleware)` below.
router.post("/webhook", razorpayWebhookController.handle);

router.use(authMiddleware);

router.post("/orders", paymentsController.createOrder);
router.get("/orders/:id", paymentsController.getOrder);
router.post("/orders/:id/verify", paymentsController.verifyOrder);
router.get("/history", paymentsController.listHistory);

export const paymentsRoutes = router;
