import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { dealerAuthMiddleware } from "../../middlewares/parking-dealer.middleware";
import { parkingEmployeeAuthMiddleware } from "../../middlewares/parking-employee.middleware";
import { bookingCreateLimiter } from "../../middlewares/booking-rate-limit.middleware";
import { parkingController } from "./parking.controller";
import { dealerController } from "./dealer.controller";
import { employeeController } from "./employee.controller";
import { adminDealerController } from "./admin-dealer.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ── Gupio-admin-facing (onboarding dealers) — separate from both customer
// and dealer auth above. ──
const adminRouter = Router();
adminRouter.use(adminAuthMiddleware, requireAdminRole(["SUPER_ADMIN", "ADMIN"]));
adminRouter.post("/dealers", adminDealerController.create);
adminRouter.get("/dealers", adminDealerController.list);
adminRouter.patch("/dealers/:id/commission", adminDealerController.updateCommission);
adminRouter.get("/live-listings", adminDealerController.listLiveListings);
adminRouter.get("/listings/:id/live", adminDealerController.getListingLiveStatus);
adminRouter.get("/listings/:id/walkins/history", adminDealerController.getListingWalkInHistory);
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
dealerRouter.post("/listings/:id/slots/:slotId/checkin", dealerController.checkInWalkIn);
dealerRouter.post("/walkins/:walkInId/checkout", dealerController.checkOutWalkIn);
dealerRouter.get("/listings/:id/live", dealerController.getListingLiveStatus);
dealerRouter.get("/listings/:id/walkins/history", dealerController.getListingWalkInHistory);
dealerRouter.get("/live-listings", dealerController.listLiveListings);
dealerRouter.get("/bookings", dealerController.listBookings);
dealerRouter.post("/bookings/:id/checkout", dealerController.checkoutBooking);
dealerRouter.post("/bookings/:id/no-show", dealerController.markBookingNoShow);
dealerRouter.post("/bookings/:id/undo-no-show", dealerController.undoBookingNoShow);
dealerRouter.post("/bookings/:id/checkin", dealerController.markBookingCheckedIn);
dealerRouter.get("/settlements", dealerController.listSettlements);
dealerRouter.post("/employees", dealerController.createEmployee);
dealerRouter.get("/employees", dealerController.listEmployees);
dealerRouter.patch("/employees/:employeeId", dealerController.setEmployeeActive);
dealerRouter.patch("/employees/:employeeId/listings", dealerController.setEmployeeListings);
router.use("/dealer", dealerRouter);

// ── Employee-facing (dealer's on-ground staff — separate, more restricted
// auth) — mounted first for the same reason as dealerRouter above. ──
const employeeRouter = Router();
employeeRouter.post("/auth/login", employeeController.login);
employeeRouter.use(parkingEmployeeAuthMiddleware);
employeeRouter.get("/listings", employeeController.listListings);
employeeRouter.get("/listings/:id/slots", employeeController.listSlotWindows);
employeeRouter.post("/listings/:id/slots/:slotId/checkin", employeeController.checkInWalkIn);
employeeRouter.post("/walkins/:walkInId/checkout", employeeController.checkOutWalkIn);
employeeRouter.get("/listings/:id/live", employeeController.getListingLiveStatus);
employeeRouter.get("/listings/:id/walkins/history", employeeController.getListingWalkInHistory);
employeeRouter.get("/live-listings", employeeController.listLiveListings);
employeeRouter.get("/bookings", employeeController.listBookings);
employeeRouter.post("/bookings/:id/checkout", employeeController.checkoutBooking);
employeeRouter.post("/bookings/:id/no-show", employeeController.markBookingNoShow);
employeeRouter.post("/bookings/:id/undo-no-show", employeeController.undoBookingNoShow);
employeeRouter.post("/bookings/:id/checkin", employeeController.markBookingCheckedIn);
router.use("/employee", employeeRouter);

// ── Customer-facing ──────────────────────────────────────────────
router.get("/search", parkingController.search);
router.get("/listings/:id", parkingController.getListing);
router.get("/listings/:id/availability", parkingController.getAvailability);

router.use(authMiddleware);
router.post("/bookings", bookingCreateLimiter, parkingController.createBooking);
router.get("/bookings", parkingController.listMyBookings);
router.post("/bookings/:id/cancel", parkingController.cancelBooking);
router.get("/bookings/:id/extra-payment", parkingController.getExtraPayment);
router.post("/waitlist", parkingController.joinWaitlist);
router.delete("/waitlist", parkingController.leaveWaitlist);

export const parkingRoutes = router;
