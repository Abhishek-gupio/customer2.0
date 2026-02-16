import "dotenv/config";

import axios from "axios";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import twilio from "twilio";

export interface SMSService {
  sendOTP(phoneNumber: string, otp: string): Promise<boolean>;
  sendSMS(phoneNumber: string, message: string, dltTemplateId?: string): Promise<boolean>;
  sendVoice?(phoneNumber: string, message: string): Promise<boolean>;
}

export class Flash49SMSService implements SMSService {
  private getConfig(): { username: string; password: string; from: string; dltContentId: string } | null {
    const username = process.env.FLASH49_USERNAME;
    const password = process.env.FLASH49_PASSWORD;
    const from = process.env.FLASH49_FROM;
    const dltContentId = process.env.FLASH49_DLT_CONTENT_ID;

    if (!username || !password || !from || !dltContentId) {
      console.error("Missing required Flash49 environment variables");
      return null;
    }
    return { username, password, from, dltContentId };
  }

  private static formatPhoneNumber(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    return digits.startsWith("91") ? digits : `91${digits}`;
  }

  private static isValidDlt(id?: string | null): boolean {
    return !!id && /^\d{4,19}$/.test(id);
  }

  private static buildParams(
    cfg: { username: string; password: string; from: string; dltContentId: string },
    to: string,
    otp: string
  ) {
    return {
      username: cfg.username,
      password: cfg.password,
      unicode: true,
      from: cfg.from,
      to,
      text: `Your OTP is ${otp} to Login GUPIO. It is valid for 10 minutes. Do not share this with anyone. GUPIO.`,
      dltContentId: cfg.dltContentId,
    };
  }

  private static isAccepted(data: unknown): boolean {
    const d = data as { state?: string; description?: string };
    if (d?.state === "SUBMIT_ACCEPTED") return true;
    if (d?.state === "SUBMIT_FAILED") {
      console.error("SMS submission failed:", d?.description);
      return false;
    }
    console.error("Unexpected response from Flash49:", d);
    return false;
  }

  async sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      const cfg = this.getConfig();
      if (!cfg) return false;
      const to = Flash49SMSService.formatPhoneNumber(phoneNumber);
      const params = Flash49SMSService.buildParams(cfg, to, otp);
      const url = "https://api.flash49.com/fe/api/v1/send";
      const { data } = await axios.get(url, { params });
      return Flash49SMSService.isAccepted(data);
    } catch (error: any) {
      console.error("Error sending OTP:", error?.response?.data || error.message);
      return false;
    }
  }

  async sendSMS(phoneNumber: string, message: string, dltTemplateId?: string): Promise<boolean> {
    try {
      const cfg = this.getConfig();
      if (!cfg) return false;
      const to = Flash49SMSService.formatPhoneNumber(phoneNumber);
      const params = {
        username: cfg.username,
        password: cfg.password,
        unicode: true,
        from: cfg.from,
        to,
        text: message,
        dltContentId: dltTemplateId || cfg.dltContentId, // Use specific template if provided
      };
      const url = "https://api.flash49.com/fe/api/v1/send";
      const { data } = await axios.get(url, { params });
      return Flash49SMSService.isAccepted(data);
    } catch (error: any) {
      console.error("Error sending SMS:", error?.response?.data || error.message);
      return false;
    }
  }
}

export class TwilioSMSService implements SMSService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || "";
  }

  async sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
    return this.sendSMS(phoneNumber, `Your OTP is ${otp} to Login GUPIO.`);
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`,
      });
      return !!result.sid;
    } catch (error: any) {
      console.error("Twilio SMS Error:", error.message);
      return false;
    }
  }

  async sendVoice(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // TwiML for reading the message
      const twiml = `<Response><Say>${message}</Say></Response>`;
      const result = await this.client.calls.create({
        twiml,
        to: phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`,
        from: this.fromNumber,
      });
      return !!result.sid;
    } catch (error: any) {
      console.error("Twilio Voice Error:", error.message);
      return false;
    }
  }
}


export class GmailSMSService implements SMSService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  async sendOTP(emailAddress: string, otp: string): Promise<boolean> {
    return this.sendSMS(emailAddress, `Your OTP is ${otp} to Login GUPIO.`, otp);
  }

  async sendSMS(emailAddress: string, message: string, otp?: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: emailAddress,
        subject: "GUPIO Tech Park Analyzer - Notification",
        html: otp ? this.createEmailTemplate(otp) : `<p>${message}</p>`,
        text: message,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return !!info.messageId;
    } catch (error: any) {
      console.error("Error sending Email notification:", error.message);
      return false;
    }
  }

  private createEmailTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>GUPIO OTP Verification</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a202c;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
          .header p { font-size: 16px; opacity: 0.9; font-weight: 400; }
          .content { padding: 40px 30px; background: #ffffff; }
          .content h2 { font-size: 24px; font-weight: 600; color: #1a202c; margin-bottom: 16px; }
          .content p { font-size: 16px; color: #4a5568; margin-bottom: 24px; line-height: 1.7; }
          .otp-box {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            padding: 32px 24px;
            text-align: center;
            margin: 32px 0;
            border-radius: 12px;
            border: 2px solid #e2e8f0;
            position: relative;
            overflow: hidden;
          }
          .otp-box::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
          }
          .otp-code {
            font-size: 48px;
            font-weight: 800;
            color: #2d3748;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin-bottom: 12px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .otp-validity { font-size: 14px; color: #718096; font-weight: 500; }
          .security-notice {
            background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
            border: 1px solid #feb2b2;
            padding: 24px;
            border-radius: 12px;
            margin: 32px 0;
            position: relative;
          }
          .security-notice::before {
            content: '🔒';
            position: absolute;
            top: -12px; left: 20px;
            background: #ffffff;
            padding: 4px 8px;
            border-radius: 50%;
            font-size: 16px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .security-notice h3 { font-size: 18px; font-weight: 600; color: #c53030; margin-bottom: 16px; padding-left: 8px; }
          .security-notice ul { list-style: none; padding-left: 8px; }
          .security-notice li { font-size: 14px; color: #742a2a; margin-bottom: 8px; position: relative; padding-left: 20px; }
          .security-notice li::before { content: '•'; position: absolute; left: 0; color: #e53e3e; font-weight: bold; }
          .footer {
            background: #f7fafc;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .footer p { font-size: 12px; color: #718096; margin-bottom: 8px; }
          .footer .copyright { font-weight: 500; color: #4a5568; }
          @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 12px; }
            .header { padding: 30px 20px; }
            .content { padding: 30px 20px; }
            .footer { padding: 20px; }
            .otp-code { font-size: 36px; letter-spacing: 6px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>GUPIO Tech Park Analyzer</h1>
          </div>
          <div class="content">
            <h2>Hello there! 👋</h2>
            <p>We received a login request for your GUPIO Tech Park Analyzer account. To ensure your account security, please use the verification code below to complete your login process.</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-validity">⏰ Valid for 10 minutes</div>
            </div>
            <div class="security-notice">
              <h3>Security Notice</h3>
              <ul>
                <li>Never share this verification code with anyone</li>
                <li>GUPIO will never ask for your OTP via phone call or email</li>
                <li>If you didn't request this code, please ignore this email</li>
                <li>For additional security, enable two-factor authentication</li>
              </ul>
            </div>
            <p>If you have any questions or concerns, please don't hesitate to contact our support team. We're here to help!</p>
            <p style="margin-top: 32px; font-weight: 500; color: #2d3748;">
              Best regards,<br>
              <strong>The GUPIO Team</strong>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated security message. Please do not reply to this email.</p>
            <p class="copyright">&copy; 2024 GUPIO Tech Park Analyzer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

/**
 * Lightweight email helper using the same Gmail transporter approach as GmailSMSService.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromOverride?: string;
}): Promise<boolean> {
  try {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      console.error("GMAIL credentials missing: set GMAIL_USER and GMAIL_APP_PASSWORD");
      return false;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const mailOptions = {
      from: options.fromOverride || user,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    } as nodemailer.SendMailOptions;

    const info = await transporter.sendMail(mailOptions);
    if (info.messageId) {
      console.log(`Email sent successfully with ID: ${info.messageId}`);
      try {
        const logDir = path.resolve(process.cwd(), "logs");
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        const logPath = path.join(logDir, "email.log");
        fs.appendFileSync(
          logPath,
          `[${new Date().toISOString()}] SENT to=${options.to} subject="${options.subject}" messageId=${info.messageId}\n`
        );
      } catch (logErr: any) {
        console.warn("Email logging failed:", logErr?.message || logErr);
      }
      return true;
    }
    console.error("Failed to send email (no messageId returned)");
    try {
      const logDir = path.resolve(process.cwd(), "logs");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, "email.log");
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] FAILED to=${options.to} subject="${options.subject}" reason=no-message-id\n`
      );
    } catch { }
    return false;
  } catch (error: any) {
    console.error("Error sending email:", error?.response?.data || error.message);
    try {
      const logDir = path.resolve(process.cwd(), "logs");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, "email.log");
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] ERROR to=${options.to} subject="${options.subject}" error="${(error?.message || "").toString()}"\n`
      );
    } catch { }
    return false;
  }
}

/**
 * Build a branded HTML email for a new contact form submission.
 */
export function buildContactFormEmailHTML(contact: {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName?: string | null;
  communicationMethod: string;
  city?: string | null;
  createdAt: string | Date;
}): string {
  const created = new Date(contact.createdAt).toLocaleString();
  const rows = [
    { label: "Name", value: contact.name },
    { label: "Email", value: contact.email },
    { label: "Phone", value: contact.phone },
    { label: "Company", value: contact.companyName ?? "-" },
    { label: "Preferred Communication", value: contact.communicationMethod },
    { label: "City", value: contact.city ?? "-" },
    { label: "Submitted At", value: created },
    { label: "Submission ID", value: contact.id },
  ];

  const rowHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; color: #4a5568; width: 220px; font-weight: 600;">${r.label}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${String(r.value).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
    </tr>
  `
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New Contact Form Submission</title>
  </head>
  <body style="margin:0;padding:24px;background:#f7fafc;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.06);overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:20px 24px;color:#fff;">
        <h1 style="margin:0;font-size:20px;">New Contact Form Submission</h1>
        <div style="opacity:0.9;font-size:13px;margin-top:4px;">You received a new lead via the website contact form.</div>
      </div>
      <div style="padding:20px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tbody>
            ${rowHtml}
          </tbody>
        </table>
        <div style="margin-top:16px;font-size:12px;color:#718096;">Respond promptly to improve conversion.</div>
      </div>
      <div style="background:#f7fafc;padding:14px 24px;border-top:1px solid #e2e8f0;color:#718096;font-size:12px;text-align:center;">This is an automated message. Please do not reply.</div>
    </div>
  </body>
  </html>
  `;
}

class MockSMSService implements SMSService {
  sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
    return this.sendSMS(phoneNumber, `Your OTP is ${otp} to Login GUPIO.`);
  }

  sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    console.log("\n========================================");
    console.log("📱 [MOCK SMS SERVICE - NOTIFICATION]");
    console.log("========================================");
    console.log("📞 Target:", phoneNumber);
    console.log("📝 Message:", message);
    console.log("========================================\n");
    return Promise.resolve(true);
  }
}

export function getSMSService(): SMSService {
  const svc = process.env.SMS_SERVICE;
  if (process.env.NODE_ENV === "development" || svc === "MOCK") {
    console.log("📱 Using Mock SMS Service for development/testing");
    return new MockSMSService();
  }
  if (svc === "GMAIL") {
    console.log("📧 Using Gmail SMS Service");
    return new GmailSMSService();
  }
  if (svc === "GUPIO") {
    console.log("📱 Using Flash49 SMS Service");
    return new Flash49SMSService();
  }
  if (svc === "TWILIO") {
    console.log("📱 Using Twilio SMS Service");
    return new TwilioSMSService();
  }
  console.log("📧 Defaulting to Gmail SMS Service");
  return new GmailSMSService();
}
