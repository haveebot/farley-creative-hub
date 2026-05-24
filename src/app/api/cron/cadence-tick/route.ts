/**
 * Cadence cron tick — processes due enrollments.
 *
 *   GET /api/cron/cadence-tick
 *
 * Invoked by Vercel Cron per vercel.json. Authenticated via CRON_SECRET
 * (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`).
 *
 * For each due enrollment:
 *   1. Load cadence + next step + prospect + primary contact + brand
 *   2. Draft via Claude (subject + body) using brand voice + prospect context
 *   3. Create prospect_sends row (pending)
 *   4. If Resend configured: send + mark sent/failed + advance enrollment
 *      Send failure also advances (don't get stuck on a bad address);
 *      Claude failure does NOT advance (transient — try again next tick)
 *   5. If Resend NOT configured: leave send pending, log warning, do
 *      NOT advance (so the operator sees the send queued + waiting)
 *
 * Idempotency-ish: limit to 50 enrollments per tick; if a tick fails
 * mid-way, the remaining enrollments are picked up on the next tick.
 */

import { NextResponse } from "next/server";
import { draftWithClaude } from "@/lib/ai/claude";
import { getBrandKit, getStudioKit } from "@/lib/db/brand-kits";
import { listSteps, getCadence } from "@/lib/db/cadences";
import {
  advanceEnrollment,
  createSend,
  findDueEnrollments,
  markSendFailed,
  markSendSent,
} from "@/lib/db/enrollments";
import { sendEmail } from "@/lib/email";
import { getProspect, listContacts, logActivity } from "@/lib/db/prospects";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

export async function GET(request: Request) {
  // Vercel Cron auth — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const hasResend = !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;

  const due = await findDueEnrollments(50);
  const results: Array<{
    enrollment_id: number;
    prospect_id: number;
    step_number: number;
    outcome:
      | "sent"
      | "send_failed"
      | "queued_no_resend"
      | "skipped_no_contact"
      | "skipped_no_step"
      | "draft_failed";
    detail?: string;
  }> = [];

  for (const enrollment of due) {
    try {
      const nextStepNumber = enrollment.current_step + 1;

      const [cadence, steps, prospect, contacts] = await Promise.all([
        getCadence(enrollment.cadence_id),
        listSteps(enrollment.cadence_id),
        getProspect(enrollment.prospect_id),
        listContacts(enrollment.prospect_id),
      ]);

      const step = steps.find((s) => s.step_number === nextStepNumber);
      if (!step) {
        // No more steps — complete the enrollment.
        await advanceEnrollment(enrollment.id); // advanceEnrollment auto-completes when no next step
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "skipped_no_step",
        });
        continue;
      }

      if (!prospect) {
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "skipped_no_contact",
          detail: "prospect not found",
        });
        continue;
      }

      // Find primary contact (or first with email).
      const primary =
        contacts.find((c) => c.is_primary && c.email) ?? contacts.find((c) => c.email);
      if (!primary?.email) {
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "skipped_no_contact",
          detail: "no contact with email",
        });
        continue;
      }

      // Load voice (cadence's brand kit; fall back to studio kit).
      const brand =
        (cadence?.brand_kit_id
          ? await getBrandKit(cadence.brand_kit_id)
          : null) ?? (await getStudioKit());

      // Draft via Claude. Subject comes from step.subject_template if set,
      // otherwise Claude drafts it; the body always comes from Claude.
      let subject: string;
      let body: string;
      try {
        const drafted = await draftWithClaude({
          kind: "email",
          prompt: step.draft_prompt,
          brand,
          prospect,
        });
        const parsed = parseEmailDraft(drafted.content);
        subject = step.subject_template ?? parsed.subject;
        body = parsed.body;
      } catch (err) {
        console.error(`[cadence-tick] Claude draft failed for enrollment ${enrollment.id}`, err);
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "draft_failed",
          detail: (err as Error).message,
        });
        // Don't advance — try again next tick.
        continue;
      }

      // Create the send row.
      const send = await createSend({
        enrollment_id: enrollment.id,
        step_id: step.id,
        step_number: step.step_number,
        to_email: primary.email,
        to_name: primary.name,
        subject,
        body,
        scheduled_for: enrollment.next_send_at ?? new Date(),
      });

      if (!hasResend) {
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "queued_no_resend",
          detail: "RESEND_API_KEY or RESEND_FROM_EMAIL not set; send queued in pending state",
        });
        // Don't advance — operator sees a queued send waiting for Resend config.
        continue;
      }

      // Attempt the send.
      try {
        await sendEmail({ to: primary.email, subject, text: body });
        // sendEmail throws on Resend error but doesn't expose the message id;
        // we record success without an id rather than refactor email.ts here.
        await markSendSent(send.id, "");
        await logActivity({
          prospect_id: enrollment.prospect_id,
          kind: "email_sent",
          content: `Cadence step ${step.step_number}: ${subject}`,
          created_by: "cron:cadence-tick",
        });
        await advanceEnrollment(enrollment.id);
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "sent",
        });
      } catch (err) {
        console.error(`[cadence-tick] Resend send failed for enrollment ${enrollment.id}`, err);
        await markSendFailed(send.id, (err as Error).message);
        // Advance on send failure so we don't get stuck on a bad address;
        // the failed send row stays as the audit trail.
        await advanceEnrollment(enrollment.id);
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "send_failed",
          detail: (err as Error).message,
        });
      }
    } catch (err) {
      console.error(`[cadence-tick] unexpected error for enrollment ${enrollment.id}`, err);
      results.push({
        enrollment_id: enrollment.id,
        prospect_id: enrollment.prospect_id,
        step_number: enrollment.current_step + 1,
        outcome: "draft_failed",
        detail: (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    has_resend: hasResend,
    results,
  });
}

/**
 * Parse Claude's email-kind output into subject + body.
 * Expected format (per kindGuidance):
 *   Subject: <line>
 *   Body: <multi-line>
 */
function parseEmailDraft(content: string): { subject: string; body: string } {
  const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
  const bodyIdx = content.search(/^Body:\s*/m);
  if (!subjectMatch || bodyIdx === -1) {
    // Claude didn't follow format — use a generic subject and the full content as body.
    return { subject: "(no subject)", body: content.trim() };
  }
  const subject = subjectMatch[1].trim();
  const body = content
    .slice(bodyIdx)
    .replace(/^Body:\s*/m, "")
    .trim();
  return { subject, body };
}
