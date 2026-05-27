"use client";

import { useState } from "react";
import {
  INDUSTRY_LABELS,
  SERVICE_LABELS,
  SIZE_LABELS,
} from "@/lib/pipeline-shared";
import type { ClientRow } from "./page";

export default function ClientsPanel({
  initialClients,
}: {
  initialClients: ClientRow[];
}) {
  const [search, setSearch] = useState<string>("");
  const searchTerm = search.trim().toLowerCase();

  const filtered = initialClients.filter((c) => {
    if (!searchTerm) return true;
    const haystack = [
      c.prospect.business_name,
      c.prospect.city,
      c.prospect.state,
      c.prospect.industry,
      c.prospect.notes,
      c.prospect.next_action,
      c.brand_kit?.name,
      ...(c.prospect.service_interest ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchTerm);
  });

  const withKitCount = initialClients.filter((c) => c.brand_kit).length;
  const withoutKitCount = initialClients.length - withKitCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, city, industry, brand kit…"
            className="w-full pl-9 pr-3 py-2 bg-transparent border border-border rounded-md text-sm focus:outline-none focus:border-accent transition"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>
          <strong className="text-foreground">{initialClients.length}</strong>{" "}
          signed client{initialClients.length !== 1 ? "s" : ""}
        </span>
        <span className="text-border">·</span>
        <span>
          <strong className="text-foreground">{withKitCount}</strong> with brand kit
        </span>
        {withoutKitCount > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="text-amber-600 dark:text-amber-400">
              <strong>{withoutKitCount}</strong> need kit setup
            </span>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          {initialClients.length === 0 ? (
            <>
              No signed clients yet. Once a prospect signs, mark them{" "}
              <code className="text-xs">signed</code> in the pipeline and they
              land here.
            </>
          ) : (
            "No clients match the current search."
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <ClientRowItem key={c.prospect.id} client={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientRowItem({ client }: { client: ClientRow }) {
  const { prospect, brand_kit, last_activity_at } = client;
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ");
  const services = prospect.service_interest.slice(0, 4);
  const isOverdue =
    prospect.next_action_date &&
    new Date(prospect.next_action_date) < new Date(new Date().toDateString());

  return (
    <li>
      <a
        href={`/pipeline/${prospect.id}`}
        className="block p-5 border border-border rounded-lg bg-surface hover:border-accent transition"
      >
        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              {brand_kit?.accent_color && (
                <span
                  className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: brand_kit.accent_color }}
                  title={`Brand kit: ${brand_kit.name}`}
                />
              )}
              <h3 className="font-medium">{prospect.business_name}</h3>
              {brand_kit ? (
                <a
                  href={`/brand/${brand_kit.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition"
                >
                  {brand_kit.name}
                </a>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  No brand kit
                </span>
              )}
              {prospect.industry && (
                <span className="text-xs text-muted">
                  {INDUSTRY_LABELS[prospect.industry] ?? prospect.industry}
                </span>
              )}
              {prospect.size && (
                <span className="text-xs text-muted">
                  {SIZE_LABELS[prospect.size] ?? prospect.size}
                </span>
              )}
              {location && <span className="text-xs text-muted">{location}</span>}
            </div>
            {services.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {services.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded-full bg-surface-strong text-muted"
                  >
                    {SERVICE_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            )}
            {last_activity_at && (
              <p className="text-xs text-muted mt-2">
                Last touched {formatRelative(last_activity_at)}
              </p>
            )}
          </div>
          {prospect.next_action && (
            <div className="text-right shrink-0">
              <p className="text-xs text-muted">Next</p>
              <p className="text-sm font-medium">{prospect.next_action}</p>
              {prospect.next_action_date && (
                <p
                  className={`text-xs ${isOverdue ? "text-red-600" : "text-muted"}`}
                >
                  {new Date(prospect.next_action_date).toLocaleDateString()}
                  {isOverdue && " · overdue"}
                </p>
              )}
            </div>
          )}
        </div>
      </a>
    </li>
  );
}

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
