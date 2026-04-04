import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export async function sendMemberPasswordEmail(to: string, password: string) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: "Tu acceso a Legions Club",
    text: `¡Bienvenido!\n\nTu contraseña temporal es: ${password}\n\nPor favor cámbiala después de iniciar sesión.`,
    html: `<p>¡Bienvenido!</p><p>Tu contraseña temporal es: <b>${password}</b></p><p>Por favor cámbiala después de iniciar sesión.</p>`,
  });
}
