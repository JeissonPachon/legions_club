import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export async function sendTwoFactorEmail(to: string, code: string) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEV] 2FA code for ${to}: ${code}`);
    return;
  }

  if (!env.SMTP_HOST || env.SMTP_HOST.includes("example")) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: "Legions Club access code",
    text: `Your login verification code is: ${code}`,
    html: `<p>Your login verification code is:</p><h2>${code}</h2><p>This code expires in ${env.AUTH_2FA_TTL_MINUTES} minutes.</p>`,
  });
}