import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tripExpenseController } from "./trip-expense.controller";

const router = Router();

router.use(authMiddleware);

// POST /v1/trip-expense/calculate
// Body: { from: "Mysuru, Karnataka", to: "Kochi, Kerala", vehicleId?: "...", vehicleType?: "CAR", fuelType?: "PETROL" }
router.post("/calculate", tripExpenseController.calculate);

// GET /v1/trip-expense/vehicle-types
// Returns supported vehicle types for the UI
router.get("/vehicle-types", tripExpenseController.getVehicleTypes);

export const tripExpenseRoutes = router;
