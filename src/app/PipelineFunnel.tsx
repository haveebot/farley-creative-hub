import type { Prospect } from "@/lib/pipeline-shared";
import { STATUS_LABELS, type ProspectStatus } from "@/lib/pipeline-shared";

type Lead = {
  id: number;
  created_at: string | Date;
};

type ActivityEvent = {
  kind: string;
  created_at: string | Date;
  prospect_id?: number;
};

// Positive-flow funnel stages, in order. 'passed' and 'dormant' are
// terminal/cold buckets shown separately (not in the funnel).
const FUNNEL_STAGES: ProspectStatus[] = [
  "lead",
  "contacted",
  "discovery",
  "proposal",
  "negotiating",
  "signed",
];

const SIDE_STAGES: ProspectStatus[] = ["passed", "dormant"];

export default function PipelineFunnel({
  prospects,
  leads,
  activity,
}: {
  prospects: Prospect[];
  leads: Lead[];
  activity: ActivityEvent[];
}) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const thisWeekStart = now - 7 * dayMs;
  const lastWeekStart = now - 14 * dayMs;

  // Funnel counts.
  const funnelCounts = FUNNEL_STAGES.map((stage) => ({
    stage,
    count: prospects.filter((p) => p.status === stage).length,
  }));
  const maxFunnel = Math.max(1, ...funnelCounts.map((f) => f.count));

  // Side bucket counts.
  const sideCounts = SIDE_STAGES.map((stage) => ({
    stage,
    count: prospects.filter((p) => p.status === stage).length,
  }));

  // Week-over-week.
  const newLeadsThisWeek = leads.filter(
    (l) => new Date(l.created_at).getTime() > thisWeekStart,
  ).length;
  const newLeadsLastWeek = leads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t > lastWeekStart && t <= thisWeekStart;
  }).length;

  const signedThisWeek = prospects.filter(
    (p) => p.status === "signed" && new Date(p.updated_at).getTime() > thisWeekStart,
  ).length;
  const signedLastWeek = prospects.filter(
    (p) =>
      p.status === "signed" &&
      new Date(p.updated_at).getTime() > lastWeekStart &&
      new Date(p.updated_at).getTime() <= thisWeekStart,
  ).length;

  const statusChangesThisWeek = activity.filter(
    (a) => a.kind === "status_change" && new Date(a.created_at).getTime() > thisWeekStart,
  ).length;
  const statusChangesLastWeek = activity.filter((a) => {
    const t = new Date(a.created_at).getTime();
    return a.kind === "status_change" && t > lastWeekStart && t <= thisWeekStart;
  }).length;

  // Stale alerts: active prospects (not signed/passed/dormant) with no
  // touch in 21+ days. Sorted by stalest first.
  const staleProspects = prospects
    .filter(
      (p) =>
        !["signed", "passed", "dormant"].includes(p.status) &&
        new Date(p.updated_at).getTime() < now - 21 * dayMs,
    )
    .sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    )
    .slice(0, 5);

  // Top hot prospects: active + has activity in last 7d, sorted by latest activity.
  const prospectActivityMap = new Map<number, number>(); // prospect_id → latest activity timestamp
  for (const a of activity) {
    if (!a.prospect_id) continue;
    const t = new Date(a.created_at).getTime();
    const prior = prospectActivityMap.get(a.prospect_id) ?? 0;
    if (t > prior) prospectActivityMap.set(a.prospect_id, t);
  }
  const hotProspects = prospects
    .filter((p) => !["signed", "passed", "dormant"].includes(p.status))
    .map((p) => ({
      prospect: p,
      lastActivity: prospectActivityMap.get(p.id) ?? new Date(p.updated_at).getTime(),
    }))
    .filter((p) => p.lastActivity > thisWeekStart)
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .slice(0, 5);

  const allEmpty =
    funnelCounts.every((f) => f.count === 0) &&
    sideCounts.every((s) => s.count === 0) &&
    leads.length === 0;

  if (allEmpty) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-4">
        Pipeline
      </h2>
      <div className="border border-border rounded-lg bg-surface p-6 space-y-8">
        {/* Funnel */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-3">Funnel</p>
          <ul className="space-y-1.5">
            {funnelCounts.map(({ stage, count }) => (
              <li key={stage} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-muted text-xs">{STATUS_LABELS[stage]}</span>
                <div className="flex-1 h-6 bg-border/40 rounded relative overflow-hidden">
                  <div
                    className="h-full bg-accent/70 transition-all"
                    style={{
                      width: count > 0 ? `${Math.max(4, (count / maxFunnel) * 100)}%` : "0",
                    }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
          {sideCounts.some((s) => s.count > 0) && (
            <p className="text-xs text-muted mt-3">
              {sideCounts
                .filter((s) => s.count > 0)
                .map((s) => `${s.count} ${STATUS_LABELS[s.stage].toLowerCase()}`)
                .join(" · ")}
            </p>
          )}
        </div>

        {/* This week vs last week */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            Last 7 days <span className="text-muted/70">vs prior 7</span>
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <WeekStat
              label="New leads"
              current={newLeadsThisWeek}
              prior={newLeadsLastWeek}
            />
            <WeekStat
              label="Status advances"
              current={statusChangesThisWeek}
              prior={statusChangesLastWeek}
            />
            <WeekStat label="Signed" current={signedThisWeek} prior={signedLastWeek} />
          </div>
        </div>

        {/* Hot prospects */}
        {hotProspects.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-3">
              Hot this week
            </p>
            <ul className="space-y-1.5 text-sm">
              {hotProspects.map(({ prospect, lastActivity }) => (
                <li key={prospect.id} className="flex items-center justify-between">
                  <a
                    href={`/pipeline/${prospect.id}`}
                    className="truncate hover:underline"
                  >
                    {prospect.business_name}{" "}
                    <span className="text-xs text-muted">
                      · {STATUS_LABELS[prospect.status as ProspectStatus]}
                    </span>
                  </a>
                  <span className="text-xs text-muted shrink-0 ml-3">
                    {formatRelative(new Date(lastActivity))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stale alerts */}
        {staleProspects.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-3">
              Stale (21d+ no activity)
            </p>
            <ul className="space-y-1.5 text-sm">
              {staleProspects.map((p) => {
                const daysSince = Math.floor(
                  (Date.now() - new Date(p.updated_at).getTime()) / dayMs,
                );
                return (
                  <li key={p.id} className="flex items-center justify-between">
                    <a
                      href={`/pipeline/${p.id}`}
                      className="truncate hover:underline"
                    >
                      <span className="text-red-600 text-xs">●</span>{" "}
                      {p.business_name}{" "}
                      <span className="text-xs text-muted">
                        · {STATUS_LABELS[p.status as ProspectStatus]}
                      </span>
                    </a>
                    <span className="text-xs text-muted shrink-0 ml-3">
                      {daysSince}d cold
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function WeekStat({
  label,
  current,
  prior,
}: {
  label: string;
  current: number;
  prior: number;
}) {
  const delta = current - prior;
  const deltaSign = delta > 0 ? "+" : delta < 0 ? "" : "";
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-serif tabular-nums">{current}</span>
        {(current > 0 || prior > 0) && (
          <span
            className={`text-xs tabular-nums ${
              delta > 0
                ? "text-accent"
                : delta < 0
                  ? "text-red-600"
                  : "text-muted"
            }`}
          >
            {deltaSign}
            {delta} vs {prior}
          </span>
        )}
      </div>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}
