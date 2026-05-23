/**
 * Operator allowlist — who can sign in.
 *
 * Phase 1: env-var-driven. OPERATOR_EMAILS is a comma-separated list
 * (normalized lowercase). Anything not in the list gets a generic
 * "if your email is authorized, you'll receive a link" response —
 * never echo back whether an unknown email exists.
 *
 * Future: when the database has an operator table, this moves to a DB
 * lookup. For now env-var is simple, secure, and zero-config beyond
 * Vercel env vars.
 */

function getAllowlist(): string[] {
  const raw = process.env.OPERATOR_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedOperator(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getAllowlist().includes(normalized);
}
