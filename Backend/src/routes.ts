import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes";
import { customerRoutes } from "./modules/customer/customer.routes";
import { documentRoutes } from "./modules/document/document.routes";
import { vehicleRoutes } from "./modules/vehicle/vehicle.routes";

const router = Router();

router.use("/v1/auth", authRoutes);
router.use("/v1/customer", customerRoutes);
router.use("/v1/documents", documentRoutes);
router.use("/v1/vehicles", vehicleRoutes);

export const apiRoutes = router;
