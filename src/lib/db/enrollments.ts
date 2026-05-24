/**
 * Prospect enrollments + sends CRUD — server-only (imports pg).
 *
 * Client should import types from @/lib/cadences-shared.
 *
 * Enrollment lifecycle:
 *   - createEnrollment: status='active', current_step=0, next_send_at = NOW() + step1 delay
 *   - cron tick: finds due enrollments, drafts + sends step, advances current_step,
 *     sets next_send_at for the next step (or completes if no more steps)
 *   - pauseEnrollment: status='paused', clears next_send_at (resumable)
 *   - resumeEnrollment: status='active', recomputes next_send_at from current state
 *   - cancelEnrollment: status='cancelled', records cancelled_at + reason (terminal)
 *   - completeEnrollment: status='completed' (terminal; called when last step sent)
 */

import { query, queryOne } from "./client";
import { listSteps } from "./cadences";
import { stepDelayMs } from "@/lib/cadences-shared";
import type {
  EnrollmentStatus,
  ProspectEnrollment,
  ProspectSend,
  SendStatus,
} from "@/lib/cadences-shared";

export type {
  EnrollmentStatus,
  ProspectEnrollment,
  ProspectSend,
  SendStatus,
} from "@/lib/cadences-shared";

// ============ Enrollments ============

export type EnrollmentCreate = {
  prospect_id: number;
  cadence_id: number;
  enrolled_by: string;
};

export async function listEnrollments(filter?: { status?: EnrollmentStatus }): Promise<ProspectEnrollment[]> {
  if (filter?.status) {
    return query<ProspectEnrollment>(
      `SELECT * FROM prospect_enrollments WHERE status = $1 ORDER BY enrolled_at DESC`,
      [filter.status],
    );
  }
  return query<ProspectEnrollment>(
    `SELECT * FROM prospect_enrollments ORDER BY enrolled_at DESC`,
  );
}

export async function getEnrollment(id: number): Promise<ProspectEnrollment | null> {
  return queryOne<ProspectEnrollment>(
    `SELECT * FROM prospect_enrollments WHERE id = $1`,
    [id],
  );
}

export async function getActiveEnrollmentForProspect(
  prospectId: number,
): Promise<ProspectEnrollment | null> {
  return queryOne<ProspectEnrollment>(
    `SELECT * FROM prospect_enrollments
       WHERE prospect_id = $1 AND status = 'active'
       LIMIT 1`,
    [prospectId],
  );
}

export async function listEnrollmentsForProspect(
  prospectId: number,
): Promise<ProspectEnrollment[]> {
  return query<ProspectEnrollment>(
    `SELECT * FROM prospect_enrollments
       WHERE prospect_id = $1
       ORDER BY enrolled_at DESC`,
    [prospectId],
  );
}

export async function listEnrollmentsForCadence(
  cadenceId: number,
): Promise<ProspectEnrollment[]> {
  return query<ProspectEnrollment>(
    `SELECT * FROM prospect_enrollments
       WHERE cadence_id = $1
       ORDER BY enrolled_at DESC`,
    [cadenceId],
  );
}

/**
 * Enroll a prospect in a cadence. Sets current_step=0 and computes the
 * next_send_at as NOW() + step1's delay. The unique-active-enrollment
 * index prevents enrolling the same prospect in another active cadence
 * simultaneously.
 */
export async function createEnrollment(input: EnrollmentCreate): Promise<ProspectEnrollment> {
  const steps = await listSteps(input.cadence_id);
  if (steps.length === 0) {
    throw new Error("Cadence has no steps");
  }
  const step1 = steps[0];
  const nextSendAt = new Date(Date.now() + stepDelayMs(step1));

  const row = await queryOne<ProspectEnrollment>(
    `INSERT INTO prospect_enrollments
       (prospect_id, cadence_id, status, current_step, next_send_at, enrolled_by)
     VALUES ($1, $2, 'active', 0, $3, $4)
     RETURNING *`,
    [input.prospect_id, input.cadence_id, nextSendAt, input.enrolled_by],
  );
  if (!row) throw new Error("Failed to create enrollment");
  return row;
}

export async function pauseEnrollment(id: number): Promise<ProspectEnrollment> {
  const row = await queryOne<ProspectEnrollment>(
    `UPDATE prospect_enrollments
        SET status = 'paused', next_send_at = NULL
      WHERE id = $1 AND status = 'active'
      RETURNING *`,
    [id],
  );
  if (!row) throw new Error("Enrollment not found or not active");
  return row;
}

export async function resumeEnrollment(id: number): Promise<ProspectEnrollment> {
  const enrollment = await getEnrollment(id);
  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.status !== "paused") throw new Error("Enrollment is not paused");

  // Determine the next step to send (current_step + 1) and recompute next_send_at.
  const steps = await listSteps(enrollment.cadence_id);
  const nextStepNumber = enrollment.current_step + 1;
  const nextStep = steps.find((s) => s.step_number === nextStepNumber);
  if (!nextStep) {
    // No more steps — mark completed instead of resumed.
    return completeEnrollment(id);
  }

  const nextSendAt = new Date(Date.now() + stepDelayMs(nextStep));
  const row = await queryOne<ProspectEnrollment>(
    `UPDATE prospect_enrollments
        SET status = 'active', next_send_at = $2
      WHERE id = $1
      RETURNING *`,
    [id, nextSendAt],
  );
  if (!row) throw new Error("Failed to resume enrollment");
  return row;
}

export async function cancelEnrollment(id: number, reason?: string): Promise<ProspectEnrollment> {
  const row = await queryOne<ProspectEnrollment>(
    `UPDATE prospect_enrollments
        SET status = 'cancelled',
            next_send_at = NULL,
            cancelled_at = NOW(),
            cancel_reason = $2
      WHERE id = $1
      RETURNING *`,
    [id, reason ?? null],
  );
  if (!row) throw new Error("Failed to cancel enrollment");
  return row;
}

export async function completeEnrollment(id: number): Promise<ProspectEnrollment> {
  const row = await queryOne<ProspectEnrollment>(
    `UPDATE prospect_enrollments
        SET status = 'completed',
            next_send_at = NULL,
            completed_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id],
  );
  if (!row) throw new Error("Failed to complete enrollment");
  return row;
}

/**
 * Advance an enrollment after a successful send. Sets current_step and
 * computes next_send_at for the next step — or completes if no more.
 */
export async function advanceEnrollment(id: number): Promise<ProspectEnrollment> {
  const enrollment = await getEnrollment(id);
  if (!enrollment) throw new Error("Enrollment not found");

  const steps = await listSteps(enrollment.cadence_id);
  const newCurrentStep = enrollment.current_step + 1;
  const nextStep = steps.find((s) => s.step_number === newCurrentStep + 1);

  if (!nextStep) {
    // Last step — complete.
    const row = await queryOne<ProspectEnrollment>(
      `UPDATE prospect_enrollments
          SET status = 'completed',
              current_step = $2,
              next_send_at = NULL,
              completed_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, newCurrentStep],
    );
    if (!row) throw new Error("Failed to advance enrollment");
    return row;
  }

  const nextSendAt = new Date(Date.now() + stepDelayMs(nextStep));
  const row = await queryOne<ProspectEnrollment>(
    `UPDATE prospect_enrollments
        SET current_step = $2, next_send_at = $3
      WHERE id = $1
      RETURNING *`,
    [id, newCurrentStep, nextSendAt],
  );
  if (!row) throw new Error("Failed to advance enrollment");
  return row;
}

/**
 * Find enrollments whose next_send_at is due (used by the cron tick).
 * Limits to a sane batch size to avoid overwhelming the tick.
 */
export async function findDueEnrollments(limit = 50): Promise<ProspectEnrollment[]> {
  return query<ProspectEnrollment>(
    `SELECT * FROM prospect_enrollments
       WHERE status = 'active'
         AND next_send_at IS NOT NULL
         AND next_send_at <= NOW()
       ORDER BY next_send_at ASC
       LIMIT $1`,
    [limit],
  );
}

// ============ Sends ============

export type SendCreate = {
  enrollment_id: number;
  step_id: number;
  step_number: number;
  to_email: string;
  to_name?: string | null;
  subject: string;
  body: string;
  scheduled_for: Date | string;
  send_via?: "gmail" | "resend" | "none";
};

export async function listSendsForEnrollment(enrollmentId: number): Promise<ProspectSend[]> {
  return query<ProspectSend>(
    `SELECT * FROM prospect_sends
       WHERE enrollment_id = $1
       ORDER BY scheduled_for DESC`,
    [enrollmentId],
  );
}

export async function listRecentSends(limit = 50): Promise<ProspectSend[]> {
  return query<ProspectSend>(
    `SELECT * FROM prospect_sends ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
}

export async function createSend(input: SendCreate): Promise<ProspectSend> {
  const row = await queryOne<ProspectSend>(
    `INSERT INTO prospect_sends
       (enrollment_id, step_id, step_number, to_email, to_name,
        subject, body, status, scheduled_for, send_via)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, COALESCE($9, 'gmail'))
     RETURNING *`,
    [
      input.enrollment_id,
      input.step_id,
      input.step_number,
      input.to_email,
      input.to_name ?? null,
      input.subject,
      input.body,
      input.scheduled_for,
      input.send_via ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create send");
  return row;
}

/**
 * Mark a send as successfully delivered. `externalMessageId` is the
 * provider's message id (Gmail's `id`, Resend's `id`, etc.) — stored
 * in the `resend_message_id` column for historical compat; the column
 * is effectively channel-agnostic regardless of name.
 */
export async function markSendSent(id: number, externalMessageId: string): Promise<ProspectSend> {
  const row = await queryOne<ProspectSend>(
    `UPDATE prospect_sends
        SET status = 'sent',
            resend_message_id = $2,
            sent_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, externalMessageId],
  );
  if (!row) throw new Error("Failed to mark send sent");
  return row;
}

/**
 * Mark a send as drafted (Gmail draft created, awaiting human review + send).
 * Stores the Gmail draft id in the resend_message_id column.
 */
export async function markSendDrafted(id: number, draftId: string): Promise<ProspectSend> {
  const row = await queryOne<ProspectSend>(
    `UPDATE prospect_sends
        SET status = 'drafted',
            resend_message_id = $2
      WHERE id = $1
      RETURNING *`,
    [id, draftId],
  );
  if (!row) throw new Error("Failed to mark send drafted");
  return row;
}

export async function markSendFailed(id: number, error: string): Promise<ProspectSend> {
  const row = await queryOne<ProspectSend>(
    `UPDATE prospect_sends
        SET status = 'failed',
            error_message = $2
      WHERE id = $1
      RETURNING *`,
    [id, error],
  );
  if (!row) throw new Error("Failed to mark send failed");
  return row;
}
