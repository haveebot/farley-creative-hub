/**
 * Cadence cron tick — processes due enrollments.
 *
 *   GET /api/cron/cadence-tick
 *
 * Invoked by Vercel Cron per vercel.json. Authenticated via CRON_SECRET
 * (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`).
 *
 * Send channel preference (per tick, decided once at top):
 *   1. Gmail (via /settings/workspace OAuth connection) — preferred.
 *      Sends land in the connected account's Sent folder, replies
 *      thread natively.
 *   2. Resend — fallback if no Workspace connection is active.
 *   3. None — neither configured. Sends queue in pending state without
 *      advancing the enrollment, so the operator sees the queue waiting.
 *
 * For each due enrollment:
 *   1. Load cadence + step + prospect + primary contact + brand
 *   2. Draft via Claude (subject + body) using brand voice + prospect context
 *   3. Create prospect_sends row with the chosen send_via
 *   4. Try to send via the chosen channel; advance enrollment on send
 *      success (or send failure — don't get stuck on a bad address);
 *      Claude draft failure does NOT advance (transient — retry next tick)
 *
 * Idempotency-ish: limit to 50 enrollments per tick.
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
import { sendViaGmail } from "@/lib/gmail/send";
import { getActiveConnection as getWorkspaceConnection } from "@/lib/db/workspace-connections";
import { getProspect, listContacts, logActivity } from "@/lib/db/prospects";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

type Channel = "gmail" | "resend" | "none";

type Outcome =
  | "sent"
  | "send_failed"
  | "queued_no_channel"
  | "skipped_no_contact"
  | "skipped_no_step"
  | "draft_failed";

export async function GET(request: Request) {
  // Vercel Cron auth — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  // Decide the send channel for this tick.
  const workspaceConnection = await getWorkspaceConnection();
  const hasResend = !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
  const channel: Channel = workspaceConnection ? "gmail" : hasResend ? "resend" : "none";

  const due = await findDueEnrollments(50);
  const results: Array<{
    enrollment_id: number;
    prospect_id: number;
    step_number: number;
    outcome: Outcome;
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
        await advanceEnrollment(enrollment.id);
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

      // Voice = cadence's brand kit; fall back to studio kit.
      const brand =
        (cadence?.brand_kit_id ? await getBrandKit(cadence.brand_kit_id) : null) ??
        (await getStudioKit());

      // Draft via Claude.
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
        continue;
      }

      // Create the send row, tagged with the channel we plan to use.
      const send = await createSend({
        enrollment_id: enrollment.id,
        step_id: step.id,
        step_number: step.step_number,
        to_email: primary.email,
        to_name: primary.name,
        subject,
        body,
        scheduled_for: enrollment.next_send_at ?? new Date(),
        send_via: channel,
      });

      if (channel === "none") {
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "queued_no_channel",
          detail:
            "No send channel available — connect Workspace at /settings/workspace, or set RESEND_API_KEY + RESEND_FROM_EMAIL. Send queued in pending state.",
        });
        // Don't advance — operator sees a queued send waiting for a channel.
        continue;
      }

      try {
        let messageId = "";
        if (channel === "gmail") {
          const result = await sendViaGmail({
            to: primary.email,
            toName: primary.name,
            subject,
            text: body,
          });
          messageId = result.id;
        } else {
          // channel === 'resend'
          await sendEmail({ to: primary.email, subject, text: body });
          // sendEmail doesn't expose the Resend message id; empty string ok.
        }

        await markSendSent(send.id, messageId);
        await logActivity({
          prospect_id: enrollment.prospect_id,
          kind: "email_sent",
          content: `Cadence step ${step.step_number} (${channel}): ${subject}`,
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
        console.error(
          `[cadence-tick] ${channel} send failed for enrollment ${enrollment.id}`,
          err,
        );
        await markSendFailed(send.id, (err as Error).message);
        // Advance on send failure so we don't get stuck on a bad address.
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
    channel,
    has_workspace: !!workspaceConnection,
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
    return { subject: "(no subject)", body: content.trim() };
  }
  const subject = subjectMatch[1].trim();
  const body = content
    .slice(bodyIdx)
    .replace(/^Body:\s*/m, "")
    .trim();
  return { subject, body };
}
