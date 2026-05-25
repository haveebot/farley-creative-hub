/**
 * Daily Briefing — Claude-generated morning read for the Hub home.
 *
 * Pulls signals from every data surface the Hub has, hands them to
 * Claude with a tight prompt, returns a 1-2 paragraph briefing that
 * reads like a smart assistant catching the operator up on what
 * matters today.
 *
 * The full structured context is also saved alongside the rendered
 * briefing so we can audit + debug what Claude was looking at.
 */

import Anthropic from "@anthropic-ai/sdk";
import { listDraftedSends } from "@/lib/db/enrollments";
import { listLeads } from "@/lib/db/leads";
import { listProspects } from "@/lib/db/prospects";
import { listRecentActivity } from "@/lib/db/activity-feed";
import { getStudioKit } from "@/lib/db/brand-kits";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 700;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

/**
 * Gather all the signals that feed the briefing. Pure read; no side
 * effects. Returned context is also persisted for audit.
 */
export async function gatherBriefingContext() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

  const [drafts, allLeads, allProspects, recentActivity, studio] = await Promise.all([
    listDraftedSends(20),
    listLeads(),
    listProspects(),
    listRecentActivity(20),
    getStudioKit().catch(() => null),
  ]);

  const newLeadsLast24h = allLeads.filter(
    (l) => new Date(l.created_at) > dayAgo,
  );
  const newLeadsLastWeek = allLeads.filter(
    (l) => new Date(l.created_at) > weekAgo,
  );
  const newLeads24Brief = newLeadsLast24h.slice(0, 8).map((l) => ({
    business_name: l.business_name,
    source_title: l.source_title,
    industry: l.industry,
    service_signal: l.service_signal,
    summary: l.notes ? l.notes.slice(0, 200) : null,
  }));

  const activeProspects = allProspects.filter(
    (p) => !["signed", "passed", "dormant"].includes(p.status),
  );
  const overdueProspects = activeProspects
    .filter(
      (p) =>
        p.next_action_date &&
        p.next_action_date <= todayIso,
    )
    .map((p) => ({
      business_name: p.business_name,
      status: p.status,
      next_action: p.next_action,
      next_action_date: p.next_action_date,
      days_overdue:
        p.next_action_date
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(p.next_action_date).getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            )
          : 0,
    }));

  const goneCoolProspects = activeProspects
    .filter((p) => new Date(p.updated_at) < threeWeeksAgo)
    .slice(0, 5)
    .map((p) => ({
      business_name: p.business_name,
      status: p.status,
      days_since_touch: Math.floor(
        (Date.now() - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000),
      ),
    }));

  const recentSignedProspects = allProspects
    .filter((p) => p.status === "signed")
    .filter((p) => new Date(p.updated_at) > weekAgo)
    .slice(0, 3)
    .map((p) => ({ business_name: p.business_name }));

  return {
    today: todayIso,
    studio_name: studio?.name ?? "the studio",
    drafts_awaiting_review: drafts.map((d) => ({
      prospect: d.prospect_business_name,
      subject: d.subject,
      step_number: d.step_number,
    })),
    drafts_awaiting_count: drafts.length,
    new_leads_24h_count: newLeadsLast24h.length,
    new_leads_7d_count: newLeadsLastWeek.length,
    new_leads_24h: newLeads24Brief,
    overdue_prospects: overdueProspects,
    gone_cold_prospects: goneCoolProspects,
    recent_signed: recentSignedProspects,
    pipeline_totals: {
      active: activeProspects.length,
      signed: allProspects.filter((p) => p.status === "signed").length,
      total_prospects: allProspects.length,
      total_leads: allLeads.length,
    },
    recent_activity_summary: recentActivity.slice(0, 5).map((a) => ({
      title: a.title,
      at: a.at,
    })),
  };
}

const SYSTEM_PROMPT = `You write the daily morning briefing for the operator of a creative-studio operations hub.

The studio is the operator's own business — you address them as the studio's principal (the "you" in the briefing). Tone is a smart, warm chief-of-staff: specific, brief, action-oriented, never robotic, never sycophantic. No "Good morning!" preamble. No "I hope this email finds you well" energy. Lead with what's most important; end with at most one suggested next move.

Rules:
- Output 1-2 short paragraphs, 60-140 words total. Tight enough to read in 15 seconds.
- Cite specific names from the context (prospect names, lead business names). Don't generalize when you have specifics.
- Surface what's NEW since yesterday + what's stale + what's hot. Lead with the most actionable.
- If there are cadence drafts awaiting review, mention them first — those are about to go to real clients and need her eyes.
- If there's nothing notable, say so honestly. Don't manufacture urgency.
- Never use exclamation marks. Never use the phrase "looks great" or "exciting" or "let's get started."
- Don't repeat numbers ("3 new leads — three from Indeed, three sources") — say each fact once.
- End with at most ONE suggested action. Make it specific (named entity) when possible. Don't write a to-do list.

Output the briefing text only. No markdown formatting. No section headers. Plain prose.`;

export async function generateDailyBriefing(
  context: Awaited<ReturnType<typeof gatherBriefingContext>>,
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's signals (JSON):\n\n${JSON.stringify(context, null, 2)}\n\nWrite the briefing.`,
      },
    ],
  });

  return response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
}
