import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { dealerAuthMiddleware } from "../../middlewares/parking-dealer.middleware";
import { parkingController } from "./parking.controller";
import { dealerController } from "./dealer.controller";

const router = Router();

// ── Dealer-facing (separate auth) — mounted first since /dealer/auth/login
// must stay reachable without authMiddleware, which is applied below it. ──
const dealerRouter = Router();
dealerRouter.post("/auth/login", dealerController.login);
dealerRouter.use(dealerAuthMiddleware);
dealerRouter.post("/listings", dealerController.createListing);
dealerRouter.patch("/listings/:id", dealerController.updateListing);
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
