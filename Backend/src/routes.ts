import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes";
import { customerRoutes } from "./modules/customer/customer.routes";
import { documentRoutes } from "./modules/document/document.routes";
import { vehicleRoutes } from "./modules/vehicle/vehicle.routes";
import { sharingRoutes } from "./modules/sharing/sharing.routes";
import { notificationRoutes } from "./modules/notification/notification.routes";
import { expenseRoutes } from "./modules/expense/expense.routes";
import { chatRoutes } from "./modules/chat/chat.routes";
import { telematicsRoutes } from "./modules/telematics/telematics.routes";

import { aiRoutes } from "./modules/ai/ai.routes";

import { sosRoutes } from "./modules/sos/sos.routes";
import { placesRoutes } from "./modules/places/places.routes";
import { fuelRoutes } from "./modules/fuel/fuel.routes";
import { discoveryRoutes } from "./modules/discovery/discovery.routes";
import { supportRoutes } from "./modules/support/support.routes";
import { adminRoutes } from "./modules/admin/admin.routes";

const router = Router();

// ==========================================
// PUBLIC DIGILOCKER REDIRECTS (No Auth)
// ==========================================
router.get("/v1/documents/digilocker/mock-auth", (req, res) => {
  const { client_id } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify with DigiLocker</title>
      <style>
        body { margin: 0; padding: 0; background-color: #F9FAFB; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
        .card { background: white; width: 90%; max-width: 400px; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        .logo { width: 150px; margin-bottom: 24px; }
        h1 { font-size: 22px; color: #111; margin-bottom: 16px; }
        p { color: #6B7280; font-size: 14px; margin-bottom: 32px; line-height: 1.5; }
        .btn { display: block; background: #000; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; }
        .footer { margin-top: 24px; font-size: 12px; color: #9CA3AF; }
      </style>
    </head>
    <body>
      <div class="card">
        <img src="https://gupiosolutions.com/wp-content/uploads/2024/11/logo.png" class="logo" />
        <h1>Verify your identity</h1>
        <p>This is a <b>Secure Test Environment</b>.<br>Click below to simulate a successful DigiLocker verification for your account.</p>
        <a href="/api/v1/documents/digilocker/success?client_id=${client_id}" class="btn">Start Verification</a>
        <div class="footer">Client ID: ${client_id} (Simulated)</div>
      </div>
    </body>
    </html>
  `);
});

router.get("/v1/documents/digilocker/success", (req, res) => {
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
});

router.use("/v1/auth", authRoutes);
router.use("/v1/customer", customerRoutes);
router.use("/v1/documents", documentRoutes);
router.use("/v1/vehicles", vehicleRoutes);
router.use("/v1/sharing", sharingRoutes);
router.use("/v1/notifications", notificationRoutes);
router.use("/v1/expenses", expenseRoutes);
router.use("/v1/chat", chatRoutes);
router.use("/v1/telematics", telematicsRoutes);
router.use("/v1/ai", aiRoutes);
router.use("/v1/sos", sosRoutes);
router.use("/v1/places", placesRoutes);
router.use("/v1/fuel", fuelRoutes);
router.use("/v1/discovery", discoveryRoutes);
router.use("/v1/support", supportRoutes);
router.use("/v1/admin", adminRoutes);

export const apiRoutes = router;
