import { Router } from "express";
import { userController } from "./user.controller";

const router = Router();

router.get("/", userController.getAll);
router.get("/:id", userController.getOne);
router.post("/", userController.create);
router.patch("/:id", userController.update);
router.delete("/:id", userController.delete);

export const userRoutes = router;
