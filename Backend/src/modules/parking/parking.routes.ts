import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { dealerAuthMiddleware } from "../../middlewares/parking-dealer.middleware";
import { parkingController } from "./parking.controller";
import { dealerController } from "./dealer.controller";
import { adminDealerController } from "./admin-dealer.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ── Gupio-admin-facing (onboarding dealers) — separate from both customer
// and dealer auth above. ──
const adminRouter = Router();
adminRouter.use(adminAuthMiddleware, requireAdminRole(["SUPER_ADMIN", "ADMIN"]));
adminRouter.post("/dealers", adminDealerController.create);
adminRouter.get("/dealers", adminDealerController.list);
router.use("/admin", adminRouter);

// ── Dealer-facing (separate auth) — mounted first since /dealer/auth/login
// must stay reachable without authMiddleware, which is applied below it. ──
const dealerRouter = Router();
dealerRouter.post("/auth/login", dealerController.login);
dealerRouter.use(dealerAuthMiddleware);
dealerRouter.post("/listings", dealerController.createListing);
dealerRouter.patch("/listings/:id", dealerController.updateListing);
dealerRouter.post("/listings/:id/photos", upload.array("photos", 6), dealerController.uploadPhotos);
dealerRouter.get("/listings", dealerController.listListings);
dealerRouter.post("/listings/:id/slots", dealerController.createSlotWindows);
dealerRouter.get("/listings/:id/slots", dealerController.listSlotWindows);
dealerRouter.get("/bookings", dealerController.listBookings);
router.use("/dealer", dealerRouter);

// ── Customer-facing ──────────────────────────────────────────────
router.get("/search", parkingController.search);
router.get("/listings/:id", parkingController.getListing);
router.get("/listings/:id/availability", parkingController.getAvailability);

router.use(authMiddleware);
router.post("/bookings", parkingController.createBooking);
router.get("/bookings", parkingController.listMyBookings);
router.post("/bookings/:id/cancel", parkingController.cancelBooking);
router.post("/waitlist", parkingController.joinWaitlist);

export const parkingRoutes = router;
