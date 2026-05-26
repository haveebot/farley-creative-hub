"use client";

import { useState } from "react";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_LABELS,
  type Lead,
  type LeadSourceType,
  type LeadStatus,
} from "@/lib/leads-shared";

/** Tab-level view buckets — proper inbox-style triage.
 *  Active = anything that needs action.
 *  Dismissed = passed leads (kept for de-dup + audit, hidden from default).
 *  Converted = promoted to prospect (now lives in the pipeline view).
 *  All = unfiltered, for searches. */
type ViewTab = "active" | "dismissed" | "converted" | "all";

const ACTIVE_STATUSES: LeadStatus[] = ["new", "reviewing", "qualified"];

function inTab(status: LeadStatus, tab: ViewTab): boolean {
  if (tab === "all") return true;
  if (tab === "active") return ACTIVE_STATUSES.includes(status);
  return status === tab;
}

export default function LeadsPanel({
  initialLeads,
}: {
  initialLeads: Lead[];
}) {
  const [tab, setTab] = useState<ViewTab>("active");
  const [filterSource, setFilterSource] = useState<LeadSourceType | "all">("all");
  const [filterState, setFilterState] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const statesPresent = Array.from(
    new Set(initialLeads.map((l) => l.state).filter(Boolean)),
  ).sort();

  const searchTerm = search.trim().toLowerCase();

  const tabCounts = {
    active: initialLeads.filter((l) => ACTIVE_STATUSES.includes(l.status)).length,
    dismissed: initialLeads.filter((l) => l.status === "dismissed").length,
    converted: initialLeads.filter((l) => l.status === "converted").length,
    all: initialLeads.length,
  };

  const filtered = initialLeads.filter((l) => {
    if (!inTab(l.status, tab)) return false;
    if (filterSource !== "all" && l.source_type !== filterSource) return false;
    if (filterState !== "all" && l.state !== filterState) return false;
    if (searchTerm) {
      const haystack = [
        l.business_name,
        l.source_title,
        l.city,
        l.state,
        l.industry,
        l.size,
        l.notes,
        l.source_url,
        ...(l.service_signal ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

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
            placeholder="Search by name, city, title, industry…"
            className="w-full pl-9 pr-3 py-2 bg-transparent border border-border rounded-md text-sm focus:outline-none focus:border-accent transition"
            autoComplete="off"
          />
        </div>
        <a
          href="/pipeline/leads/new"
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          + New lead
        </a>
      </div>

      {/* Tab bar — Active is default; Dismissed/Converted hidden behind a click */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {(
          [
            ["active", "Active"],
            ["dismissed", "Dismissed"],
            ["converted", "Converted"],
            ["all", "All"],
          ] as Array<[ViewTab, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === k
                ? "text-accent border-accent"
                : "text-muted border-transparent hover:text-foreground"
            }`}
          >
            {label}{" "}
            <span className="text-xs text-muted ml-0.5">({tabCounts[k]})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as LeadSourceType | "all")}
          className={filterClasses}
        >
          <option value="all">All sources</option>
          {LEAD_SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>
          ))}
        </select>
        {statesPresent.length > 0 && (
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className={filterClasses}
          >
            <option value="all">All states</option>
            {statesPresent.map((s) => (
              <option key={s} value={s as string}>{s}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-muted ml-2">
          {filtered.length} shown
          {searchTerm && ` matching "${searchTerm}"`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          {initialLeads.length === 0
            ? "No leads yet. Paste a job posting, article, or RFP to capture your first signal."
            : tab === "active"
              ? "🎉 Active queue is clear. Switch to the Dismissed or Converted tab to review past leads."
              : "No leads match the current filters in this tab."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((l) => (
            <LeadRow key={l.id} lead={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const location = [lead.city, lead.state].filter(Boolean).join(", ");
  const terminal: LeadStatus[] = ["converted", "dismissed"];
  const isTerminal = terminal.includes(lead.status);
  return (
    <li>
      <a
        href={`/pipeline/leads/${lead.id}`}
        className={`block p-5 border border-border rounded-lg bg-surface hover:border-accent transition ${
          isTerminal ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h3 className="font-medium truncate">
                {lead.business_name || lead.source_title || "Untitled lead"}
              </h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isTerminal ? "bg-surface-strong text-muted" : "bg-accent/10 text-accent"
                }`}
              >
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
              <span className="text-xs text-muted">
                {LEAD_SOURCE_LABELS[lead.source_type]}
              </span>
              {location && <span className="text-xs text-muted">{location}</span>}
            </div>
            {lead.source_title && lead.business_name && (
              <p className="text-sm text-muted truncate">{lead.source_title}</p>
            )}
            {lead.service_signal.length > 0 && (
              <p className="text-xs text-muted mt-1">
                Signal: {lead.service_signal.join(", ")}
              </p>
            )}
          </div>
          {lead.source_url && (
            <span className="text-xs text-muted shrink-0">↗ source</span>
          )}
        </div>
      </a>
    </li>
  );
}

const filterClasses = "px-3 py-1.5 bg-transparent border border-border rounded-md text-sm";
