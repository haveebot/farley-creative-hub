/**
 * Cadences — shared types (no DB imports; safe for client components).
 *
 * The cadence MVP runs email cascades: a Cadence is an ordered sequence
 * of Steps; a Prospect can be Enrolled in a Cadence; each Step generates
 * a Send at its scheduled time.
 */

export type Cadence = {
  id: number;
  name: string;
  description: string;
  brand_kit_id: number | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CadenceStep = {
  id: number;
  cadence_id: number;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  draft_prompt: string;
  subject_template: string | null;
  created_at: string;
};

export type CadenceWithSteps = Cadence & {
  steps: CadenceStep[];
};

export type EnrollmentStatus = "active" | "paused" | "completed" | "cancelled";

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  "active",
  "paused",
  "completed",
  "cancelled",
];

export type ProspectEnrollment = {
  id: number;
  prospect_id: number;
  cadence_id: number;
  status: EnrollmentStatus;
  current_step: number;
  next_send_at: string | null;
  enrolled_by: string;
  enrolled_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type SendStatus = "pending" | "sent" | "failed" | "bounced";

export const SEND_STATUSES: SendStatus[] = [
  "pending",
  "sent",
  "failed",
  "bounced",
];

export type ProspectSend = {
  id: number;
  enrollment_id: number;
  step_id: number;
  step_number: number;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  status: SendStatus;
  resend_message_id: string | null;
  error_message: string | null;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
};

/** Compute total delay (in milliseconds) from a step's day/hour fields. */
export function stepDelayMs(step: Pick<CadenceStep, "delay_days" | "delay_hours">): number {
  return (step.delay_days * 24 + step.delay_hours) * 60 * 60 * 1000;
}

/** Human-readable delay label, e.g. "3 days" or "2 days 4h" or "immediately". */
export function formatStepDelay(step: Pick<CadenceStep, "delay_days" | "delay_hours">): string {
  if (step.delay_days === 0 && step.delay_hours === 0) return "immediately";
  const parts: string[] = [];
  if (step.delay_days > 0) parts.push(`${step.delay_days}d`);
  if (step.delay_hours > 0) parts.push(`${step.delay_hours}h`);
  return parts.join(" ");
}
