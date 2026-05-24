"use client";

import { useState } from "react";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type Lead,
  type LeadSourceType,
  type LeadStatus,
} from "@/lib/leads-shared";

export default function LeadsPanel({
  initialLeads,
}: {
  initialLeads: Lead[];
}) {
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [filterSource, setFilterSource] = useState<LeadSourceType | "all">("all");
  const [filterState, setFilterState] = useState<string>("all");

  const statesPresent = Array.from(
    new Set(initialLeads.map((l) => l.state).filter(Boolean)),
  ).sort();

  const filtered = initialLeads.filter((l) => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSource !== "all" && l.source_type !== filterSource) return false;
    if (filterState !== "all" && l.state !== filterState) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as LeadStatus | "all")}
            className={filterClasses}
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
            ))}
          </select>
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
            {filtered.length} of {initialLeads.length}
          </span>
        </div>
        <a
          href="/pipeline/leads/new"
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
        >
          + New lead
        </a>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          {initialLeads.length === 0
            ? "No leads yet. Paste a job posting, article, or RFP to capture your first signal."
            : "No leads match the current filters."}
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
