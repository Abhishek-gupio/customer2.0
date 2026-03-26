import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { digilockerService } from "./digilocker.service";
import { AppError } from "../../utils/AppError";

export const digilockerController = {
  connect: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    
    // Pass the current host to ensured the mock URL is reachable locally
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const fullBaseUrl = `${protocol}://${host}`;
    
    const result = await digilockerService.getAuthUrl(req.customer.id, fullBaseUrl);
    success(res, result);
  }),

  callback: asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.query;
    if (typeof code !== "string") throw AppError.badRequest("Code missing");

    if (!req.customer?.id) throw AppError.unauthorized();

    const result = await digilockerService.handleCallback(
      req.customer.id,
      code,
    );
    success(res, result);
  }),

  sync: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { client_id } = req.body || {};
    const result = await digilockerService.syncDocuments(req.customer.id, client_id);
    success(res, result);
  }),

  handleSuccess: asyncHandler(async (req: Request, res: Response) => {
    const { client_id, code } = req.query;
    console.log("[DigiLockerCallback] Incoming query:", req.query);
    const activeClientId = (client_id || code) as string;

    if (activeClientId) {
      try {
        const { dbInstances } = require("@repo/db-customer");
        const connection = await dbInstances.digiLockerConnection.findFirst({
          where: { refreshToken: activeClientId }
        });

        if (connection) {
          console.log("[DigiLockerCallback] Found connection for customer:", connection.customerId);
          await digilockerService.syncDocuments(connection.customerId, activeClientId);
        } else {
          console.warn("[DigiLockerCallback] No connection found for client_id:", activeClientId);
        }
      } catch (error) {
        // Fail silently to ensure user sees the success page regardless of background sync issues
        console.error("[DigiLockerCallback] Sync Error:", error);
      }
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Successful</title>
      <style>
        body {
          margin: 0; padding: 0; display: flex; justify-content: center; align-items: center;
          height: 100vh; background-color: #000; color: #FFF; font-family: sans-serif; text-align: center;
        }
        .container { padding: 24px; }
        .icon { font-size: 64px; margin-bottom: 24px; color: #FFC107; }
        h1 { font-size: 28px; margin-bottom: 12px; }
        p { font-size: 18px; color: #8E8E93; }
        .btn {
          margin-top: 32px; background: #FFC107; color: #000; padding: 12px 24px; 
          border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✓</div>
        <h1>Verified!</h1>
        <p>Your documents are synced with Gupio.</p>
        <p style="margin-top: 10px;">Please return to the app to see your documents.</p>
        <a href="gupio://document-list" class="btn">Close & Return to App</a>
      </div>
    </body>
    </html>
  `);
  }),
};
