import { randomBytes } from "crypto";

const JOIN_CODE_ALPHABET =
  "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

export function generateJoinCode(length = 10): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length]).join("");
}

export function isValidJoinCode(code: string): boolean {
  return /^[A-Za-z0-9]{8,12}$/.test(code);
}
