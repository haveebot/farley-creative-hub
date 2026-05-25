/**
 * Backup retention policy — pure function over date keys.
 *
 * Policy (verified against handoff 5-24 PM intent):
 *   - Keep ALL backups from the last 30 days.
 *   - Keep the EARLIEST backup of each calendar month, for the last
 *     12 months (UTC).
 *   - Delete everything else.
 *
 * The two windows overlap intentionally; the union is the keep set.
 * Backup keys older than 12 months always get pruned.
 *
 * Inputs are ISO date strings (YYYY-MM-DD) extracted from blob pathnames,
 * not Date objects, so the function is timezone-free and easy to test.
 */

const DAY_MS = 86_400_000;

export type PruneDecision = {
  keep: string[];
  delete: string[];
  reasons: Record<string, "recent" | "monthly" | "prune">;
};

export function decidePrune(
  existingDateKeys: string[],
  today: Date = new Date(),
): PruneDecision {
  // Normalize: dedupe + sort ascending (oldest first).
  const dates = Array.from(new Set(existingDateKeys)).sort();

  const todayUTC = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const recentCutoffUTC = todayUTC - 30 * DAY_MS;

  // Build the set of "earliest per month" within the 12-month window.
  // Month key = YYYY-MM. We track the earliest dateKey seen per month.
  const monthlyEarliest = new Map<string, string>();
  for (const dateKey of dates) {
    const monthKey = dateKey.slice(0, 7); // YYYY-MM
    if (!monthlyEarliest.has(monthKey)) {
      monthlyEarliest.set(monthKey, dateKey);
    }
  }

  // Compute the 12 month-keys we care about: current month and the 11 prior.
  const allowedMonthKeys = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
    );
    allowedMonthKeys.add(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  const keep = new Set<string>();
  const reasons: Record<string, "recent" | "monthly" | "prune"> = {};

  for (const dateKey of dates) {
    const dateUTC = parseDateKeyUTC(dateKey);
    if (dateUTC >= recentCutoffUTC) {
      keep.add(dateKey);
      reasons[dateKey] = "recent";
    }
  }

  for (const [monthKey, dateKey] of monthlyEarliest.entries()) {
    if (allowedMonthKeys.has(monthKey)) {
      if (!keep.has(dateKey)) {
        keep.add(dateKey);
        reasons[dateKey] = "monthly";
      }
      // If already marked "recent", keep that label — it's the stronger reason.
    }
  }

  const toDelete: string[] = [];
  for (const dateKey of dates) {
    if (!keep.has(dateKey)) {
      toDelete.push(dateKey);
      reasons[dateKey] = "prune";
    }
  }

  return {
    keep: Array.from(keep).sort(),
    delete: toDelete,
    reasons,
  };
}

function parseDateKeyUTC(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d);
}

/**
 * Extract the YYYY-MM-DD prefix from a backup blob pathname like
 * `backups/2026-05-25/prod.sql.gz` or `backups/2026-05-25-prod.sql.gz`.
 * Returns null if the pathname doesn't match the expected shape.
 */
export function extractDateKey(pathname: string): string | null {
  const match = pathname.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
