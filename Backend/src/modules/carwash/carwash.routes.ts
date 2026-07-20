import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { partnerAuthMiddleware } from "../../middlewares/carwash-partner.middleware";
import { technicianAuthMiddleware } from "../../middlewares/carwash-technician.middleware";
import { carwashController } from "./carwash.controller";
import { partnerController } from "./partner.controller";
import { technicianController } from "./technician.controller";
import { adminPartnerController } from "./admin-partner.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ── Gupio-admin-facing (onboarding wash partners) ──
const adminRouter = Router();
adminRouter.use(adminAuthMiddleware, requireAdminRole(["SUPER_ADMIN", "ADMIN"]));
adminRouter.post("/partners", adminPartnerController.create);
adminRouter.get("/partners", adminPartnerController.list);
router.use("/admin", adminRouter);

// ── Partner-facing (separate auth) — mounted before authMiddleware below ──
const partnerRouter = Router();
partnerRouter.post("/auth/login", partnerController.login);
partnerRouter.use(partnerAuthMiddleware);
partnerRouter.post("/technicians", partnerController.createTechnician);
partnerRouter.get("/technicians", partnerController.listTechnicians);
partnerRouter.post("/centers", partnerController.createCenter);
partnerRouter.get("/centers", partnerController.listCenters);
partnerRouter.post("/centers/:id/slots", partnerController.createSlots);
partnerRouter.get("/centers/:id/slots", partnerController.listSlots);
partnerRouter.get("/jobs", partnerController.listJobs);
partnerRouter.post("/jobs/:id/assign-technician", partnerController.assignTechnician);
router.use("/partner", partnerRouter);

// ── Technician-facing (separate auth from partner — least-privilege field
// worker role, scoped only to jobs assigned to them) ──
const technicianRouter = Router();
technicianRouter.post("/auth/login", technicianController.login);
technicianRouter.use(technicianAuthMiddleware);
technicianRouter.get("/jobs", technicianController.listJobs);
technicianRouter.post("/jobs/:id/before-photos", upload.array("photos", 6), technicianController.uploadBeforePhotos);
technicianRouter.post("/jobs/:id/complete", upload.array("photos", 6), technicianController.completeJob);
router.use("/technician", technicianRouter);

// ── Customer-facing ──────────────────────────────────────────────
router.get("/centers/nearby", carwashController.search);
router.get("/centers/:id", carwashController.getCenter);
router.get("/centers/:id/slots", carwashController.getSlots);
router.get("/partners", carwashController.listPartners);

router.use(authMiddleware);
router.post("/bookings", carwashController.createBooking);
router.get("/bookings", carwashController.listMyBookings);
router.get("/bookings/:id", carwashController.getBooking);
router.post("/bookings/:id/cancel", carwashController.cancelBooking);

export const carwashRoutes = router;
