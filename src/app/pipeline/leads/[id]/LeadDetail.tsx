"use client";

import { useRouter } from "next/navigation";
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
import {
  INDUSTRY_LABELS,
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
  SERVICE_LABELS,
  SIZE_LABELS,
  US_STATES,
} from "@/lib/pipeline-shared";

type ConvertStatus = "idle" | "converting" | "error";

export default function LeadDetail({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [convertStatus, setConvertStatus] = useState<ConvertStatus>("idle");
  const [convertError, setConvertError] = useState<string | null>(null);

  async function update(updates: Partial<Lead>) {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setLead(data.lead);
      router.refresh();
    }
  }

  function toggleService(s: string) {
    const next = lead.service_signal.includes(s)
      ? lead.service_signal.filter((x) => x !== s)
      : [...lead.service_signal, s];
    update({ service_signal: next });
  }

  async function handleConvert() {
    if (!lead.business_name?.trim()) {
      setConvertError("Add a business name first — required to create a prospect.");
      setConvertStatus("error");
      return;
    }
    setConvertStatus("converting");
    setConvertError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/pipeline/${data.prospect.id}`);
        return;
      }
      const body = await res.json().catch(() => null);
      setConvertError(body?.message ?? body?.error ?? "Convert failed.");
      setConvertStatus("error");
    } catch {
      setConvertError("Something went wrong.");
      setConvertStatus("error");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this lead?")) return;
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (res.ok) router.push("/pipeline/leads");
  }

  const alreadyConverted = lead.status === "converted" && lead.converted_to_prospect_id;

  return (
    <div className="space-y-6">
      {/* Status bar / actions */}
      <section className="p-5 border border-border rounded-lg bg-surface flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-muted">Status:</label>
          <select
            value={lead.status}
            onChange={(e) => update({ status: e.target.value as LeadStatus })}
            className={smallSelectClasses}
            disabled={!!alreadyConverted}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Source: {LEAD_SOURCE_LABELS[lead.source_type]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {alreadyConverted ? (
            <a
              href={`/pipeline/${lead.converted_to_prospect_id}`}
              className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
            >
              Open prospect →
            </a>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={convertStatus === "converting"}
              className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {convertStatus === "converting" ? "Converting…" : "Convert to prospect"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </section>
      {convertError && (
        <p className="text-sm text-red-600 -mt-3">{convertError}</p>
      )}

      {/* Source */}
      <section className="p-5 border border-border rounded-lg bg-surface space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Source</h2>
        <InlineSelect
          label="Source type"
          value={lead.source_type}
          options={LEAD_SOURCE_TYPES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))}
          onChange={(v) => update({ source_type: v as LeadSourceType })}
        />
        <InlineText
          label="Source URL"
          value={lead.source_url ?? ""}
          onSave={(v) => update({ source_url: v || null })}
        />
        {lead.source_url && (
          <p className="text-xs">
            <a
              href={lead.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline text-muted hover:text-foreground"
            >
              ↗ Open source
            </a>
          </p>
        )}
        <InlineText
          label="Source title"
          value={lead.source_title ?? ""}
          onSave={(v) => update({ source_title: v || null })}
        />
      </section>

      {/* Business info */}
      <section className="p-5 border border-border rounded-lg bg-surface space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Business</h2>
        <InlineText
          label="Business name"
          value={lead.business_name ?? ""}
          onSave={(v) => update({ business_name: v || null })}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InlineText
            label="City"
            value={lead.city ?? ""}
            onSave={(v) => update({ city: v || null })}
          />
          <InlineSelect
            label="State"
            value={lead.state ?? ""}
            allowEmpty
            options={US_STATES.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }))}
            onChange={(v) => update({ state: v || null })}
          />
          <InlineSelect
            label="Industry"
            value={lead.industry ?? ""}
            allowEmpty
            options={PROSPECT_INDUSTRIES.map((i) => ({ value: i, label: INDUSTRY_LABELS[i] }))}
            onChange={(v) => update({ industry: v || null })}
          />
          <InlineSelect
            label="Size"
            value={lead.size ?? ""}
            allowEmpty
            options={PROSPECT_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s] }))}
            onChange={(v) => update({ size: v || null })}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Service signal</label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_INTERESTS.map((s) => {
              const on = lead.service_signal.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    on
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:border-foreground/40"
                  }`}
                >
                  {SERVICE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Content / notes */}
      <section className="p-5 border border-border rounded-lg bg-surface space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Content</h2>
        <InlineText
          label="Raw content"
          value={lead.raw_content}
          onSave={(v) => update({ raw_content: v })}
          multiline
          rows={8}
        />
        <InlineText
          label="Your notes"
          value={lead.notes}
          onSave={(v) => update({ notes: v })}
          multiline
          rows={3}
        />
      </section>

      <p className="text-xs text-muted">
        Found by {lead.found_by} · {new Date(lead.created_at).toLocaleString()}
      </p>
    </div>
  );
}

function InlineText({
  label,
  value,
  onSave,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const [v, setV] = useState(value);
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => v !== value && onSave(v)}
          rows={rows}
          className={inputClasses}
        />
      ) : (
        <input
          type="text"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => v !== value && onSave(v)}
          className={inputClasses}
        />
      )}
    </label>
  );
}

function InlineSelect({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const inputClasses =
  "w-full px-3 py-1.5 bg-transparent border border-border rounded-md text-sm focus:outline-none focus:border-accent transition";

const smallSelectClasses =
  "px-3 py-1.5 bg-transparent border border-border rounded-md text-sm";
