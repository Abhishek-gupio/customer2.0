import nodemailer from "nodemailer";
import { logger } from "../config/logger";

function createTransporter() {
  const smtpHost    = process.env.SMTP_HOST;
  const smtpUser    = process.env.SMTP_USER;
  const smtpPass    = process.env.SMTP_PASS;
  const smtpPort    = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpSecure  = process.env.SMTP_SECURE === "true";
  const gmailUser   = process.env.GMAIL_USER;
  const gmailPass   = process.env.GMAIL_APP_PASSWORD;

  // Prefer explicit SMTP config
  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  // Fallback: Gmail shorthand
  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
  }
  return null;
}


function otpEmailHtml(otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { margin:0; padding:0; background:#0a0a0a; font-family:'Segoe UI',Helvetica,Arial,sans-serif; }
    .wrapper { max-width:520px; margin:40px auto; background:#111; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
    .header { background:linear-gradient(135deg,#1a1a2e,#16213e); padding:32px 40px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:22px; font-weight:700; letter-spacing:-0.02em; }
    .header p { color:rgba(255,255,255,0.5); margin:8px 0 0; font-size:13px; }
    .body { padding:40px; }
    .otp-box { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:24px; text-align:center; margin:24px 0; }
    .otp-code { font-size:42px; font-weight:900; letter-spacing:0.2em; color:#fff; font-family:monospace; }
    .otp-label { color:rgba(255,255,255,0.4); font-size:11px; text-transform:uppercase; letter-spacing:0.15em; margin-top:8px; }
    .body p { color:rgba(255,255,255,0.6); font-size:14px; line-height:1.7; margin:0 0 16px; }
    .footer { padding:20px 40px; border-top:1px solid rgba(255,255,255,0.08); text-align:center; }
    .footer p { color:rgba(255,255,255,0.25); font-size:11px; margin:0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Admin Console</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <p>You requested a password reset for your Admin Console account. Use the OTP below to proceed. It expires in <strong style="color:#fff">5 minutes</strong>.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-label">One-Time Password</div>
      </div>
      <p>If you did not request this, you can safely ignore this email. Your password will not be changed.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Admin Console &middot; Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export const mailService = {
  async sendOtpEmail(toEmail: string, otp: string): Promise<void> {
    const transporter = createTransporter();
    const fromName = process.env.SMTP_FROM_NAME ?? "Admin Console";
    const fromEmail = process.env.SMTP_USER ?? process.env.GMAIL_USER ?? "no-reply@admin.local";

    if (!transporter) {
      logger.error({ toEmail }, "No email transporter configured. Set GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_* in .env");
      throw new Error(
        "Email service is not configured. Please contact your system administrator."
      );
    }

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmail,
        subject: "Admin Console – Your Password Reset OTP",
        html: otpEmailHtml(otp),
        text: `Your Admin Console password reset OTP is: ${otp}\n\nThis OTP expires in 5 minutes. If you did not request this, ignore this email.`,
      });
      logger.info({ toEmail }, "Password reset OTP email sent");
    } catch (err) {
      logger.error({ err, toEmail }, "Failed to send OTP email");
      throw new Error("Failed to send OTP email. Please try again.");
    }
  },
};
