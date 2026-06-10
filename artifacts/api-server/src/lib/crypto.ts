/**
 * AES-256-GCM encryption for PII fields (medical conditions, allergies).
 * Key is 32-byte base64 stored in FIELD_ENCRYPTION_KEY env var.
 * Falls back to a dev-only key when not set — NEVER use fallback in production.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
    return buf;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("FIELD_ENCRYPTION_KEY must be set in production");
  }
  // Dev-only deterministic fallback — never store real PII with this key
  return Buffer.alloc(32, "learnerlog-dev-key-do-not-use-!!");
}

/**
 * Encrypt a plain-text string.
 * Returns a base64 string: IV (12B) || tag (16B) || ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64 string produced by `encrypt`.
 * Returns null if decryption fails (corrupt data, wrong key, truncated input).
 */
export function decrypt(ciphertext: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(ciphertext, "base64");
    if (buf.length < IV_LENGTH + TAG_LENGTH) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final("utf8");
  } catch {
    return null;
  }
}

/**
 * Derive a short safe preview from medical/allergy text for display
 * to callers who have restricted access (e.g. "Medical info on file").
 */
export function derivePreview(plaintext: string | null | undefined): string | null {
  if (!plaintext?.trim()) return null;
  return "Info on file";
}
