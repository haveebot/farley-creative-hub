"use client";

import { useState } from "react";
import {
  INDUSTRY_LABELS,
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  PROSPECT_STATUSES,
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

export default function PipelinePanel({
  initialProspects,
}: {
  initialProspects: Prospect[];
}) {
  const [filterStatus, setFilterStatus] = useState<ProspectStatus | "all">("all");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<ProspectIndustry | "all">("all");
  const [filterSize, setFilterSize] = useState<ProspectSize | "all">("all");
  const [filterService, setFilterService] = useState<ServiceInterest | "all">("all");

  const filtered = initialProspects.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterState !== "all" && p.state !== filterState) return false;
    if (filterIndustry !== "all" && p.industry !== filterIndustry) return false;
    if (filterSize !== "all" && p.size !== filterSize) return false;
    if (filterService !== "all" && !p.service_interest.includes(filterService)) return false;
    return true;
  });

  const statesPresent = Array.from(
    new Set(initialProspects.map((p) => p.state).filter(Boolean)),
  ).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ProspectStatus | "all")}
            className={filterClasses}
          >
            <option value="all">All statuses</option>
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
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
            {filtered.length} of {initialProspects.length}
          </span>
        </div>
        <a
          href="/pipeline/new"
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
        >
          + New prospect
        </a>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          {initialProspects.length === 0
            ? "No prospects yet. Add your first one to start tracking outreach."
            : "No prospects match the current filters."}
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
