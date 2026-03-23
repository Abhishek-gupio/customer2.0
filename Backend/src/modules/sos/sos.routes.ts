import { Router } from "express";
// @ts-ignore
import { authMiddleware } from "../../middlewares/auth.middleware";
import * as sosController from "./sos.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", sosController.createSOS);
router.get("/active", sosController.getActiveSOS);
router.post("/:id/resolve", sosController.resolveSOS);
router.get("/nearby-help", sosController.getNearbyHelp);
router.post("/contacts", sosController.addContact);
router.get("/contacts", sosController.getContacts);
router.delete("/contacts/:id", sosController.deleteContact);

export const sosRoutes = router;
