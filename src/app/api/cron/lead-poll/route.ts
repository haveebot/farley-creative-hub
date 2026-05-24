/**
 * Lead-poll cron tick — pulls inbound emails labeled `Hub/Leads` and
 * extracts leads via Claude.
 *
 *   GET /api/cron/lead-poll
 *
 * Operator-side setup (one-time):
 *   1. Connect Workspace at /settings/workspace (already done)
 *   2. In Gmail, create a filter rule that labels matching inbound mail
 *      as "Hub/Leads". Common targets: Indeed daily digests, AngelList
 *      alerts, LinkedIn job alerts, referral emails. The Hub creates the
 *      label automatically on first tick if it doesn't exist.
 *
 * Per tick:
 *   1. Ensure the "Hub/Leads" label exists in the connected Gmail account.
 *   2. List up to 20 messages with that label.
 *   3. For each message: fetch body, parseDigest via Claude (may produce
 *      multiple leads from a single digest email), create lead rows,
 *      remove the label so the message is marked processed.
 *   4. Failures on a single message don't block others — log + skip.
 *
 * Returns JSON manifest: messages_processed, leads_created, errors.
 */

import { NextResponse } from "next/server";
import { parseDigest } from "@/lib/ai/parse-lead";
import {
  ensureLabel,
  listMessagesByLabel,
  removeLabel,
} from "@/lib/gmail/read";
import { createLead } from "@/lib/db/leads";
import type { LeadSourceType } from "@/lib/leads-shared";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // seconds — multiple Claude calls per tick

const LEAD_LABEL = "Hub/Leads";
const BATCH_SIZE = 20;

type MessageOutcome = {
  message_id: string;
  subject: string;
  leads_created: number;
  error?: string;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const connection = await getConnectionByPurpose("reading_leads");
  if (!connection) {
    return NextResponse.json({
      ok: true,
      skipped: "no-reading-leads-connection",
      detail:
        "Connect a 'Lead source' Workspace account at /settings/workspace to enable lead polling. This is the mailbox where job alerts arrive (typically separate from the 'Sending identity' used for cadence drafts).",
    });
  }

  let label;
  try {
    label = await ensureLabel(LEAD_LABEL);
  } catch (err) {
    console.error("[lead-poll] ensureLabel failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: "label-ensure-failed",
        detail: (err as Error).message,
      },
      { status: 500 },
    );
  }

  let messages;
  try {
    messages = await listMessagesByLabel(label.id, BATCH_SIZE);
  } catch (err) {
    console.error("[lead-poll] listMessagesByLabel failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: "list-messages-failed",
        detail: (err as Error).message,
      },
      { status: 500 },
    );
  }

  const results: MessageOutcome[] = [];
  let totalLeads = 0;

  for (const msg of messages) {
    const outcome: MessageOutcome = {
      message_id: msg.id,
      subject: msg.subject,
      leads_created: 0,
    };

    try {
      // Build the text fed to parseDigest — include headers as context.
      const textForClaude = [
        `Subject: ${msg.subject}`,
        `From: ${msg.from}`,
        `Date: ${msg.date}`,
        "",
        msg.body,
      ].join("\n");

      const parsedLeads = await parseDigest(textForClaude);

      for (const lead of parsedLeads) {
        try {
          await createLead({
            source_type: inferSourceType(msg.from, msg.subject),
            source_url: null,
            source_title: lead.source_title ?? msg.subject,
            business_name: lead.business_name,
            city: lead.city,
            state: lead.state,
            industry: lead.industry,
            size: lead.size,
            service_signal: lead.service_signal,
            raw_content: lead.raw_content,
            notes: lead.summary
              ? `Auto-imported from email: ${lead.summary}`
              : `Auto-imported from email "${msg.subject}"`,
            status: "new",
            found_by: "cron:lead-poll",
          });
          outcome.leads_created++;
          totalLeads++;
        } catch (err) {
          console.warn(
            `[lead-poll] createLead failed for one item in message ${msg.id}`,
            err,
          );
          // Continue to next lead in the digest.
        }
      }

      // Remove the label so we don't reprocess this message next tick.
      // Done AFTER createLead so a partial failure doesn't lose the source.
      try {
        await removeLabel(msg.id, label.id);
      } catch (err) {
        console.warn(`[lead-poll] removeLabel failed for ${msg.id}`, err);
        outcome.error = `created ${outcome.leads_created} leads but failed to remove label: ${(err as Error).message}`;
      }
    } catch (err) {
      console.error(`[lead-poll] message ${msg.id} failed`, err);
      outcome.error = (err as Error).message;
    }

    results.push(outcome);
  }

  return NextResponse.json({
    ok: true,
    workspace_email: connection.email,
    label: LEAD_LABEL,
    messages_processed: results.length,
    leads_created: totalLeads,
    results,
  });
}

/**
 * Heuristic for source_type based on the sender / subject.
 */
function inferSourceType(from: string, subject: string): LeadSourceType {
  const f = (from + " " + subject).toLowerCase();
  if (f.includes("indeed") || f.includes("ziprecruiter") || f.includes("glassdoor")) {
    return "job_posting";
  }
  if (f.includes("linkedin")) {
    return "job_posting";
  }
  if (f.includes("angellist") || f.includes("wellfound")) {
    return "job_posting";
  }
  if (f.includes("rfp") || f.includes("proposal")) {
    return "rfp";
  }
  if (f.includes("referral") || f.includes("intro")) {
    return "referral_mention";
  }
  return "other";
}
