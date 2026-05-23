/**
 * User CRUD — small surface, deliberate API.
 *
 * Phase 1: single-operator. `userExists()` gates the /setup flow;
 * once one user exists, signup self-disables.
 */

import bcrypt from "bcryptjs";
import { query, queryOne } from "./client";

export type User = {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
  updated_at: Date;
};

const SALT_ROUNDS = 12;

export async function countUsers(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users",
  );
  return row ? parseInt(row.count, 10) : 0;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email.trim()],
  );
}

/**
 * Create a new user. Throws if the email is already taken.
 */
export async function createUser(opts: {
  email: string;
  password: string;
  role?: string;
}): Promise<User> {
  const hash = await bcrypt.hash(opts.password, SALT_ROUNDS);
  const role = opts.role ?? "operator";
  const row = await queryOne<User>(
    `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
    [opts.email.trim().toLowerCase(), hash, role],
  );
  if (!row) throw new Error("Failed to create user");
  return row;
}

/**
 * Verify a password against the stored hash. Constant-time via bcrypt.
 */
export async function verifyPassword(
  user: User,
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}
