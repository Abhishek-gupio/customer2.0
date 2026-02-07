import type { Request, Response } from "express";
import { userService } from "./user.service";
import { asyncHandler } from "../../utils/asyncHandler";

export const userController = {
  getAll: asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.findAll();
    res.json(users);
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const user = await userService.findById(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const user = await userService.update(id, req.body);
    res.json(user);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await userService.delete(id);
    res.status(204).send();
  }),
};
