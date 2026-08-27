import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  requireTLS: true,
  tls: {
    rejectUnauthorized: false,
  },
});

function wrapTemplate({ heading, body, buttonLabel, buttonUrl, footer }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
            <tr><td style="font-size:22px;font-weight:700;padding-bottom:10px;">${heading}</td></tr>
            <tr><td style="font-size:14px;line-height:1.6;color:#374151;padding-bottom:20px;">${body}</td></tr>
            <tr><td style="padding-bottom:20px;"><a href="${buttonUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">${buttonLabel}</a></td></tr>
            <tr><td style="font-size:12px;color:#6b7280;word-break:break-all;">If the button does not work, use this link:<br>${buttonUrl}</td></tr>
            <tr><td style="font-size:12px;color:#9ca3af;padding-top:20px;">${footer}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail({ to, name, verificationUrl }) {
  const html = wrapTemplate({
    heading: "Verify your MediStock email",
    body: `Hi ${name || "there"},<br>Please verify your email to activate your account and start using MediStock securely.`,
    buttonLabel: "Verify email",
    buttonUrl: verificationUrl,
    footer: "If you did not create this account, you can ignore this message.",
  });

  const text = `Hi ${name || "there"},\n\nPlease verify your email to activate your account and start using MediStock securely by visiting this link:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this message.`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: "Verify your MediStock account",
      html,
      text,
    });
  } catch (error) {
    console.warn("Verification email could not be sent", error);
  }
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const html = wrapTemplate({
    heading: "Reset your MediStock password",
    body: `Hi ${name || "there"},<br>We received a request to reset your password. Click below to continue.`,
    buttonLabel: "Reset password",
    buttonUrl: resetUrl,
    footer: "If you did not request this, no action is required.",
  });

  const text = `Hi ${name || "there"},\n\nWe received a request to reset your password. Click below to continue:\n${resetUrl}\n\nIf you did not request this, no action is required.`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: "MediStock password reset",
      html,
      text,
    });
  } catch (error) {
    console.warn("Password reset email could not be sent", error);
  }
}

export async function verifySmtpConnection() {
  await transporter.verify();
}

export async function sendEmailChangeVerification({ to, name, verificationUrl }) {
  const html = wrapTemplate({
    heading: "Confirm your new email address",
    body: `Hi ${name || "there"},<br>You requested to change your email address for your MediStock account. Click below to confirm this new email.`,
    buttonLabel: "Confirm Email",
    buttonUrl: verificationUrl,
    footer: "If you did not request this change, please ignore this message.",
  });

  const text = `Hi ${name || "there"},\n\nYou requested to change your email address for your MediStock account. Click below to confirm this new email:\n${verificationUrl}\n\nIf you did not request this change, please ignore this message.`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: "Confirm your new MediStock email",
      html,
      text,
    });
  } catch (error) {
    console.warn("Email change email could not be sent", error);
  }
}

export async function sendLoginNotificationEmail({ to, name, deviceOs, deviceBrowser, ipAddress }) {
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#111827;max-width:560px;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:10px;color:#ef4444;">New Login Detected</h2>
      <p style="font-size:14px;color:#374151;">Hi ${name || "there"},</p>
      <p style="font-size:14px;color:#374151;">We detected a new login to your MediStock account.</p>
      <div style="background:#f3f4f6;padding:15px;border-radius:8px;font-size:13px;margin:20px 0;line-height:1.6;">
        <strong>Device:</strong> ${deviceBrowser || "Unknown Browser"} on ${deviceOs || "Unknown OS"}<br/>
        <strong>IP Address:</strong> ${ipAddress || "Unknown IP"}<br/>
        <strong>Time:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)
      </div>
      <p style="font-size:14px;color:#374151;">If this was you, you can ignore this email. If this wasn't you, please log into your account settings immediately and log out the unauthorized device, or change your password.</p>
      <p style="font-size:12px;color:#9ca3af;margin-top:20px;">This is an automated security notification from MediStock.</p>
    </div>
  `;

  const text = `Hi ${name || "there"},\n\nWe detected a new login to your MediStock account.\n\nDevice: ${deviceBrowser || "Unknown Browser"} on ${deviceOs || "Unknown OS"}\nIP Address: ${ipAddress || "Unknown IP"}\nTime: ${new Date().toLocaleString()}\n\nIf this was you, you can ignore this email. If this wasn't you, please log into your account settings immediately and log out the unauthorized device, or change your password.\n\nThis is an automated security notification from MediStock.`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: "Security Alert: New device login detected on MediStock",
      html,
      text,
    });
  } catch (error) {
    console.warn("Login notification email could not be sent", error);
  }
}
