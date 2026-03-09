import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

export async function hashPassword(rawPassword: string) {
  return bcrypt.hash(rawPassword, env.AUTH_BCRYPT_ROUNDS);
}

export async function verifyPassword(rawPassword: string, passwordHash: string) {
  return bcrypt.compare(rawPassword, passwordHash);
}