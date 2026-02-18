import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { notificationService } from "../../services/notification.service";
import { AppError } from "../../utils/AppError";

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const notifications = await notificationService.getNotifications(
      req.customer.id,
    );
    success(res, notifications);
  }),

  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { id } = req.params;
    await notificationService.markAsRead(req.customer.id, id as string);
    success(res, { success: true });
  }),
};
