import { createHash, randomInt } from "crypto";

export function generateTwoFactorCode() {
  return randomInt(100000, 1000000).toString();
}

export function hashTwoFactorCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}