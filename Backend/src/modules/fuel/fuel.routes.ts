import { Router } from "express";
import { fuelController } from "./fuel.controller";

const router = Router();

// /v1/fuel/state?name=Karnataka
router.get("/state", fuelController.getStateFuel);

export const fuelRoutes = router;
