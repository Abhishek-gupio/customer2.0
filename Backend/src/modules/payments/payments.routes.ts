import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { paymentOrderCreateLimiter } from "../../middlewares/booking-rate-limit.middleware";
import { paymentsController } from "./payments.controller";
import { razorpayWebhookController } from "./razorpay.webhook.controller";
import { adminPaymentsController } from "./admin-payments.controller";

const router = Router();

// No authMiddleware: Razorpay-only, verified by signature in the controller.
// Must be registered before `router.use(authMiddleware)` below.
router.post("/webhook", razorpayWebhookController.handle);

// Ops visibility — separate admin auth, mounted before the customer
// authMiddleware below so it isn't gated by a customer JWT.
const adminRouter = Router();
adminRouter.use(adminAuthMiddleware, requireAdminRole(["SUPER_ADMIN", "ADMIN"]));
adminRouter.get("/orders", adminPaymentsController.listOrders);
router.use("/admin", adminRouter);

router.use(authMiddleware);

router.post("/orders", paymentOrderCreateLimiter, paymentsController.createOrder);
router.get("/orders/:id", paymentsController.getOrder);
router.post("/orders/:id/verify", paymentsController.verifyOrder);
router.get("/history", paymentsController.listHistory);

export const paymentsRoutes = router;
