import { decryptSensitiveValue, encryptSensitiveValue, hashPII } from "@/lib/security/crypto";

process.env.ENCRYPTION_KEY = "unit-test-encryption-key-32-characters-min";

describe("security crypto", () => {
  it("encrypts and decrypts sensitive values", () => {
    const raw = "athlete-medical-note";
    const encrypted = encryptSensitiveValue(raw);
    const decrypted = decryptSensitiveValue(encrypted);

    expect(encrypted).not.toBe(raw);
    expect(decrypted).toBe(raw);
  });

  it("hashes pii deterministically", () => {
    expect(hashPII("ABC")).toBe(hashPII("abc"));
  });
});
