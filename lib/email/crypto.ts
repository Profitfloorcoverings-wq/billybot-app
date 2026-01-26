import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const TOKEN_SEPARATOR = ".";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;

  if (!keyBase64) {
    throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY is required");
  }

  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "EMAIL_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes"
    );
  }

  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((buffer) => buffer.toString("base64"))
    .join(TOKEN_SEPARATOR);
}

export function decryptToken(ciphertext: string): string {
  const [ivBase64, tagBase64, dataBase64] = ciphertext.split(TOKEN_SEPARATOR);

  if (!ivBase64 || !tagBase64 || !dataBase64) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const data = Buffer.from(dataBase64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
