"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  INDUSTRY_LABELS,
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  PROSPECT_SOURCES,
  PROSPECT_STATUSES,
  SERVICE_INTERESTS,
  SERVICE_LABELS,
  SIZE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  US_STATES,
  type ProspectIndustry,
  type ProspectSize,
  type ProspectSource,
  type ProspectStatus,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

type Status = "idle" | "saving" | "error";

export default function NewProspectForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [status, setStatus] = useState<ProspectStatus>("lead");
  const [industry, setIndustry] = useState<ProspectIndustry | "">("");
  const [size, setSize] = useState<ProspectSize | "">("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState<string>("");
  const [website, setWebsite] = useState("");
  const [source, setSource] = useState<ProspectSource | "">("");
  const [services, setServices] = useState<Set<ServiceInterest>>(new Set());
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitStatus, setSubmitStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleService(s: ServiceInterest) {
    const next = new Set(services);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setServices(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    setSubmitStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          status,
          industry: industry || undefined,
          size: size || undefined,
          city: city.trim() || undefined,
          state: stateCode || undefined,
          website_url: website.trim() || undefined,
          source: source || undefined,
          service_interest: Array.from(services),
          next_action: nextAction.trim() || undefined,
          next_action_date: nextActionDate || undefined,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/pipeline/${data.prospect.id}`);
        return;
      }
      const body = await res.json().catch(() => null);
      setSubmitStatus("error");
      setErrorMessage(body?.message ?? "Couldn't create prospect.");
    } catch {
      setSubmitStatus("error");
      setErrorMessage("Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Business name" required>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          className={inputClasses}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProspectStatus)}
            className={inputClasses}
          >
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as ProspectSource | "")}
            className={inputClasses}
          >
            <option value="">—</option>
            {PROSPECT_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Industry">
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value as ProspectIndustry | "")}
            className={inputClasses}
          >
            <option value="">—</option>
            {PROSPECT_INDUSTRIES.map((i) => (
              <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>
            ))}
          </select>
        </Field>
        <Field label="Size">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as ProspectSize | "")}
            className={inputClasses}
          >
            <option value="">—</option>
            {PROSPECT_SIZES.map((s) => (
              <option key={s} value={s}>{SIZE_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="State">
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className={inputClasses}
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Website">
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://"
          className={inputClasses}
        />
      </Field>

      <Field label="Service interest" hint="What they'd hire you for. Pick all that apply.">
        <div className="flex flex-wrap gap-2">
          {SERVICE_INTERESTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleService(s)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                services.has(s)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-foreground/40"
              }`}
            >
              {SERVICE_LABELS[s]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Next action" hint="What's the next move? E.g. 'send intro email', 'follow up on proposal'.">
          <input
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Next action date">
          <input
            type="date"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
            className={inputClasses}
          />
        </Field>
      </div>

      <Field label="Notes" hint="Anything that doesn't fit the fields above.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className={inputClasses}
        />
      </Field>

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={submitStatus === "saving" || !businessName.trim()}
          className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitStatus === "saving" ? "Saving…" : "Create + open"}
        </button>
        {errorMessage && (
          <span className="text-sm text-red-600">{errorMessage}</span>
        )}
      </div>
    </form>
  );
}

const inputClasses =
  "w-full px-4 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </span>
      {hint && <span className="block text-xs text-muted mb-2">{hint}</span>}
      {children}
    </label>
  );
}
