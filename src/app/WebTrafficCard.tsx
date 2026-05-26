"use client";

/**
 * Web traffic dashboard card for Hub home.
 *
 * Renders farleycreative.com page view + visitor totals + top pages / referrers
 * for the last 7 days (with a period switcher). Pulls from /api/web-analytics
 * which proxies the Vercel Analytics API.
 */

import { useEffect, useState } from "react";

type Period = "24h" | "7d" | "30d";

type Summary = {
  period: string;
  total_views: number;
  total_visitors: number;
  top_paths: Array<{ path: string; views: number }>;
  top_referrers: Array<{ referrer: string; views: number }>;
  countries: Array<{ country: string; views: number }>;
};

export default function WebTrafficCard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/web-analytics?period=${period}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.message ?? res.error ?? "Failed to load");
        } else {
          setData(res.summary);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <section className="border border-border rounded-lg bg-surface p-5">
      <header className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">
            Website traffic
          </p>
          <p className="text-sm font-medium">farleycreative.com</p>
        </div>
        <div className="flex gap-1">
          {(["24h", "7d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded transition ${
                period === p
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="text-sm text-muted">Loading…</p>}

      {error && (
        <div className="text-xs text-muted border-l-2 border-border pl-3 py-1 leading-relaxed">
          <p className="text-foreground/70 mb-1">Not yet configured</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Stat label="Views" value={data.total_views} />
            <Stat label="Visitors" value={data.total_visitors} />
          </div>

          {data.top_paths.length > 0 && (
            <List
              title="Top pages"
              items={data.top_paths.map((p) => ({ label: p.path, value: p.views }))}
            />
          )}
          {data.top_referrers.length > 0 && (
            <List
              title="Top referrers"
              items={data.top_referrers.map((r) => ({
                label: r.referrer || "(direct)",
                value: r.views,
              }))}
            />
          )}

          {data.total_views === 0 && (
            <p className="text-xs italic text-muted mt-3">
              No traffic yet. Once visitors land on the site, data shows up here.
            </p>
          )}
        </>
      )}

      <p className="text-[10px] text-muted mt-4 pt-3 border-t border-border">
        <a
          href="https://vercel.com/haveebots-projects/farley-creative-site/analytics"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition underline"
        >
          Open full Vercel Analytics →
        </a>
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function List({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((it, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between text-xs gap-3"
          >
            <span className="truncate min-w-0 text-foreground/90" title={it.label}>
              {it.label}
            </span>
            <span className="text-muted tabular-nums shrink-0">
              {it.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
