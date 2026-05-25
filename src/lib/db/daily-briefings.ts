/**
 * Daily Briefing CRUD — one row per calendar date.
 *
 * Generated once per day at first page load (or on operator refresh);
 * cached for subsequent loads on the same date.
 */

import { query, queryOne } from "./client";

export type DailyBriefing = {
  id: number;
  for_date: string; // YYYY-MM-DD
  content: string;
  context_summary: Record<string, unknown>;
  generated_at: Date;
  generated_by: string;
};

/**
 * Today's date as a YYYY-MM-DD string in the server's local time.
 * Vercel runs UTC; for a US-Central operator the calendar date rolls
 * over at midnight UTC (7pm CT) which is fine — briefing freshness is
 * "morning of" anyway.
 */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getBriefingForDate(date: string): Promise<DailyBriefing | null> {
  return queryOne<DailyBriefing>(
    `SELECT * FROM daily_briefings WHERE for_date = $1 LIMIT 1`,
    [date],
  );
}

export async function getTodayBriefing(): Promise<DailyBriefing | null> {
  return getBriefingForDate(todayDateString());
}

export type BriefingUpsert = {
  for_date: string;
  content: string;
  context_summary: Record<string, unknown>;
  generated_by: string;
};

export async function upsertBriefing(input: BriefingUpsert): Promise<DailyBriefing> {
  const existing = await getBriefingForDate(input.for_date);
  if (existing) {
    const row = await queryOne<DailyBriefing>(
      `UPDATE daily_briefings
          SET content = $2,
              context_summary = $3,
              generated_at = NOW(),
              generated_by = $4
        WHERE id = $1
        RETURNING *`,
      [existing.id, input.content, JSON.stringify(input.context_summary), input.generated_by],
    );
    if (!row) throw new Error("Failed to update briefing");
    return row;
  }
  const row = await queryOne<DailyBriefing>(
    `INSERT INTO daily_briefings (for_date, content, context_summary, generated_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.for_date, input.content, JSON.stringify(input.context_summary), input.generated_by],
  );
  if (!row) throw new Error("Failed to create briefing");
  return row;
}

export async function listRecentBriefings(limit = 7): Promise<DailyBriefing[]> {
  return query<DailyBriefing>(
    `SELECT * FROM daily_briefings ORDER BY for_date DESC LIMIT $1`,
    [limit],
  );
}
