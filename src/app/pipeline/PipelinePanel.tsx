"use client";

import { useState } from "react";
import {
  INDUSTRY_LABELS,
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
  SERVICE_LABELS,
  SIZE_LABELS,
  STATUS_LABELS,
  US_STATES,
  type Prospect,
  type ProspectIndustry,
  type ProspectSize,
  type ProspectStatus,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

/** Tab-level view buckets for the sales pipeline.
 *  Active = the live sales motion (lead → contacted → discovery → proposal → negotiating)
 *  Signed = won deals, ready to move to client-management
 *  Passed = lost / not pursuing
 *  Dormant = on ice, may revive
 *  All = unfiltered, for searches. */
type ViewTab = "active" | "signed" | "passed" | "dormant" | "all";

const ACTIVE_STATUSES: ProspectStatus[] = [
  "lead",
  "contacted",
  "discovery",
  "proposal",
  "negotiating",
];

function inTab(status: ProspectStatus, tab: ViewTab): boolean {
  if (tab === "all") return true;
  if (tab === "active") return ACTIVE_STATUSES.includes(status);
  return status === tab;
}

export default function PipelinePanel({
  initialProspects,
}: {
  initialProspects: Prospect[];
}) {
  const [tab, setTab] = useState<ViewTab>("active");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<ProspectIndustry | "all">("all");
  const [filterSize, setFilterSize] = useState<ProspectSize | "all">("all");
  const [filterService, setFilterService] = useState<ServiceInterest | "all">("all");
  const [search, setSearch] = useState<string>("");

  const searchTerm = search.trim().toLowerCase();

  const tabCounts = {
    active: initialProspects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
    signed: initialProspects.filter((p) => p.status === "signed").length,
    passed: initialProspects.filter((p) => p.status === "passed").length,
    dormant: initialProspects.filter((p) => p.status === "dormant").length,
    all: initialProspects.length,
  };

  const filtered = initialProspects.filter((p) => {
    if (!inTab(p.status, tab)) return false;
    if (filterState !== "all" && p.state !== filterState) return false;
    if (filterIndustry !== "all" && p.industry !== filterIndustry) return false;
    if (filterSize !== "all" && p.size !== filterSize) return false;
    if (filterService !== "all" && !p.service_interest.includes(filterService)) return false;
    if (searchTerm) {
      const haystack = [
        p.business_name,
        p.city,
        p.state,
        p.industry,
        p.size,
        p.notes,
        p.next_action,
        p.website_url,
        ...(p.service_interest ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  const statesPresent = Array.from(
    new Set(initialProspects.map((p) => p.state).filter(Boolean)),
  ).sort();

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
            placeholder="Search by name, city, industry, next action…"
            className="w-full pl-9 pr-3 py-2 bg-transparent border border-border rounded-md text-sm focus:outline-none focus:border-accent transition"
            autoComplete="off"
          />
        </div>
        <a
          href="/pipeline/new"
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          + New prospect
        </a>
      </div>

      {/* Tab bar — Active is default; signed/passed/dormant hidden behind a click */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {(
          [
            ["active", "Active"],
            ["signed", "Signed"],
            ["passed", "Passed"],
            ["dormant", "Dormant"],
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
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className={filterClasses}
        >
          <option value="all">All states</option>
          {statesPresent.map((s) => {
            const name = US_STATES.find((x) => x.code === s)?.name ?? s;
            return <option key={s} value={s as string}>{s} — {name}</option>;
          })}
        </select>
        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value as ProspectIndustry | "all")}
          className={filterClasses}
        >
          <option value="all">All industries</option>
          {PROSPECT_INDUSTRIES.map((i) => (
            <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>
          ))}
        </select>
        <select
          value={filterSize}
          onChange={(e) => setFilterSize(e.target.value as ProspectSize | "all")}
          className={filterClasses}
        >
          <option value="all">All sizes</option>
          {PROSPECT_SIZES.map((s) => (
            <option key={s} value={s}>{SIZE_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value as ServiceInterest | "all")}
          className={filterClasses}
        >
          <option value="all">All services</option>
          {SERVICE_INTERESTS.map((s) => (
            <option key={s} value={s}>{SERVICE_LABELS[s]}</option>
          ))}
        </select>
        <span className="text-xs text-muted ml-2">
          {filtered.length} shown
          {searchTerm && ` matching "${searchTerm}"`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          {initialProspects.length === 0
            ? "No prospects yet. Convert a lead or add one manually to start the sales motion."
            : tab === "active"
              ? "🎉 Active pipeline is clear. Switch to Signed / Passed / Dormant to review past prospects, or work the Leads queue to bring new ones in."
              : "No prospects match the current filters in this tab."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <ProspectRow key={p.id} prospect={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProspectRow({ prospect }: { prospect: Prospect }) {
  const locationParts = [prospect.city, prospect.state].filter(Boolean);
  const services = prospect.service_interest.slice(0, 3);
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
              <h3 className="font-medium">{prospect.business_name}</h3>
              <StatusPill status={prospect.status} />
              {prospect.industry && (
                <span className="text-xs text-muted">
                  {INDUSTRY_LABELS[prospect.industry] ?? prospect.industry}
                </span>
              )}
              {locationParts.length > 0 && (
                <span className="text-xs text-muted">{locationParts.join(", ")}</span>
              )}
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

function StatusPill({ status }: { status: ProspectStatus }) {
  // Simple visual: pill with subtle accent for active stages, muted for terminal.
  const terminal: ProspectStatus[] = ["signed", "passed", "dormant"];
  const isTerminal = terminal.includes(status);
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        isTerminal ? "bg-surface-strong text-muted" : "bg-accent/10 text-accent"
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const filterClasses = "px-3 py-1.5 bg-transparent border border-border rounded-md text-sm";
