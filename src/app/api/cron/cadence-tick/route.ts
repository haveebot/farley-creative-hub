/**
 * Cadence cron tick — DRAFT-ONLY mode.
 *
 *   GET /api/cron/cadence-tick
 *
 * Invoked by Vercel Cron per vercel.json. Authenticated via CRON_SECRET
 * (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`).
 *
 * Failsafe principle: the cron NEVER auto-sends an email. It drafts
 * each due step into the connected Workspace account's Gmail Drafts
 * folder. The human operator (Collie) reviews + sends from there.
 * Source of truth lives in her inbox, not the Hub.
 *
 * For each due enrollment:
 *   1. Load cadence + step + prospect + primary contact + brand
 *   2. Draft via Claude (subject + body) using brand voice + prospect context
 *   3. Create prospect_sends row tagged 'drafted'
 *   4. Create a Gmail draft in the connected account's Drafts folder
 *   5. Advance the enrollment (the cron's job for this step is done;
 *      sending is now in Collie's hands)
 *
 * No-Workspace fallback: if no Workspace connection is active, the
 * tick queues the send in 'pending' state WITHOUT advancing — so the
 * queue waits for Workspace to be connected, rather than silently
 * skipping or auto-sending via some other channel.
 *
 * Resend is no longer a fallback for cadence emails. Kept in the
 * codebase for purely transactional uses (signup notifications, etc.)
 * but the cron tick does not call it.
 */

import { NextResponse } from "next/server";
import { draftWithClaude } from "@/lib/ai/claude";
import { getBrandKit, getStudioKit } from "@/lib/db/brand-kits";
import { listSteps, getCadence } from "@/lib/db/cadences";
import {
  advanceEnrollment,
  createSend,
  findDueEnrollments,
  markSendDrafted,
} from "@/lib/db/enrollments";
import { createGmailDraft } from "@/lib/gmail/send";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import { getProspect, listContacts, logActivity } from "@/lib/db/prospects";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Outcome =
  | "drafted"
  | "skipped_no_workspace"
  | "skipped_no_contact"
  | "skipped_no_step"
  | "draft_failed";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const workspaceConnection = await getConnectionByPurpose("sending");

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

      if (!workspaceConnection) {
        // No Workspace connection — queue without drafting OR sending.
        // We do NOT auto-send via any other channel. Operator must connect
        // Workspace at /settings/workspace; the queued sends will be drafted
        // on the next tick after connection.
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "skipped_no_workspace",
          detail: "Workspace not connected — connect at /settings/workspace to enable drafting",
        });
        // Don't advance; next tick will retry after Workspace is connected.
        continue;
      }

      const brand =
        (cadence?.brand_kit_id ? await getBrandKit(cadence.brand_kit_id) : null) ??
        (await getStudioKit());
      const voice = await getDefaultVoiceProfile();

      let subject: string;
      let body: string;
      try {
        const drafted = await draftWithClaude({
          kind: "email",
          prompt: step.draft_prompt,
          brand,
          voice,
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

      const send = await createSend({
        enrollment_id: enrollment.id,
        step_id: step.id,
        step_number: step.step_number,
        to_email: primary.email,
        to_name: primary.name,
        subject,
        body,
        scheduled_for: enrollment.next_send_at ?? new Date(),
        send_via: "gmail",
      });

      try {
        const draftResult = await createGmailDraft({
          to: primary.email,
          toName: primary.name,
          subject,
          text: body,
        });
        await markSendDrafted(send.id, draftResult.draftId);
        await logActivity({
          prospect_id: enrollment.prospect_id,
          kind: "email_drafted",
          content: `Cadence step ${step.step_number}: ${subject} (review in Gmail Drafts)`,
          created_by: "cron:cadence-tick",
        });
        await advanceEnrollment(enrollment.id);
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "drafted",
        });
      } catch (err) {
        console.error(
          `[cadence-tick] Gmail draft create failed for enrollment ${enrollment.id}`,
          err,
        );
        // Don't mark failed on prospect_sends; keep as 'pending' so next
        // tick retries. Don't advance.
        results.push({
          enrollment_id: enrollment.id,
          prospect_id: enrollment.prospect_id,
          step_number: nextStepNumber,
          outcome: "draft_failed",
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
    mode: "draft_only",
    has_workspace: !!workspaceConnection,
    workspace_email: workspaceConnection?.email ?? null,
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
