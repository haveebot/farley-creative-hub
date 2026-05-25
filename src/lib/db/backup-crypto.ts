/**
 * Authenticated encryption for backup blobs.
 *
 * Backups contain sensitive material — Workspace OAuth refresh tokens
 * being the highest-impact item (an attacker who gets one can keep
 * issuing access tokens until Collie revokes Workspace access). Vercel
 * Blob's only access mode on v0.27 is "public" with obscure URLs — not
 * a secure-by-default surface for OAuth tokens. So we encrypt at rest.
 *
 * Algorithm: AES-256-GCM.
 * Key: 32 bytes (64 hex chars) from env BACKUP_ENCRYPTION_KEY.
 * Wire format: [12-byte IV][16-byte auth tag][ciphertext]
 *
 * Restore: scripts/backup-decrypt.ts inverts the process. Operator
 * needs the same BACKUP_ENCRYPTION_KEY value at restore time.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class BackupKeyError extends Error {}

function loadKey(): Buffer {
  const hex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!hex) {
    throw new BackupKeyError(
      "BACKUP_ENCRYPTION_KEY not set. Generate one with: openssl rand -hex 32",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new BackupKeyError(
      `BACKUP_ENCRYPTION_KEY must be 64 hex chars (32 bytes); got length ${hex.length}.`,
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new BackupKeyError(`Decoded key has wrong length: ${key.length} bytes`);
  }
  return key;
}

export function encryptBackup(plaintext: Buffer): Buffer {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptBackup(encrypted: Buffer): Buffer {
  const key = loadKey();
  if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted payload too short to contain IV + auth tag.");
  }
  const iv = encrypted.subarray(0, IV_LENGTH);
  const tag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
