"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  type LeadSourceType,
} from "@/lib/leads-shared";
import {
  INDUSTRY_LABELS,
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
  SERVICE_LABELS,
  SIZE_LABELS,
  US_STATES,
  type ProspectIndustry,
  type ProspectSize,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

type Status = "idle" | "saving" | "error";
type ParseStatus = "idle" | "parsing" | "parsed" | "error";

export default function NewLeadForm() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<LeadSourceType>("job_posting");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [industry, setIndustry] = useState<ProspectIndustry | "">("");
  const [size, setSize] = useState<ProspectSize | "">("");
  const [services, setServices] = useState<Set<ServiceInterest>>(new Set());
  const [rawContent, setRawContent] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse-with-Claude panel state
  const [parsePane, setParsePane] = useState<"text" | "url">("text");
  const [parseUrl, setParseUrl] = useState("");
  const [parseText, setParseText] = useState("");
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSummary, setParseSummary] = useState<string | null>(null);

  function toggleService(s: ServiceInterest) {
    const next = new Set(services);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setServices(next);
  }

  async function handleParse() {
    if (parsePane === "url" && !parseUrl.trim()) return;
    if (parsePane === "text" && !parseText.trim()) return;
    setParseStatus("parsing");
    setParseError(null);
    setParseSummary(null);

    try {
      const res = await fetch("/api/leads/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          parsePane === "url"
            ? { url: parseUrl.trim() }
            : { text: parseText.trim() },
        ),
      });
      if (res.ok) {
        const data = await res.json();
        const p = data.parsed;
        // Auto-populate form fields. Only overwrite empty ones (so manual edits aren't lost).
        if (p.business_name && !businessName) setBusinessName(p.business_name);
        if (p.source_title && !sourceTitle) setSourceTitle(p.source_title);
        if (p.city && !city) setCity(p.city);
        if (p.state && !stateCode) setStateCode(p.state);
        if (p.industry && (PROSPECT_INDUSTRIES as string[]).includes(p.industry) && !industry) {
          setIndustry(p.industry as ProspectIndustry);
        }
        if (p.size && (PROSPECT_SIZES as string[]).includes(p.size) && !size) {
          setSize(p.size as ProspectSize);
        }
        if (Array.isArray(p.service_signal) && p.service_signal.length > 0) {
          const next = new Set(services);
          for (const s of p.service_signal) {
            if ((SERVICE_INTERESTS as string[]).includes(s)) next.add(s as ServiceInterest);
          }
          setServices(next);
        }
        // Populate URL if it was set in the parse panel and form URL is empty.
        if (parsePane === "url" && parseUrl.trim() && !sourceUrl) {
          setSourceUrl(parseUrl.trim());
        }
        // raw_content gets the parsed text (full source, not Claude's summary).
        if (p.raw_content && !rawContent) setRawContent(p.raw_content);
        if (p.summary) setParseSummary(p.summary);
        setParseStatus("parsed");
      } else {
        const body = await res.json().catch(() => null);
        setParseError(body?.message ?? "Parse failed.");
        setParseStatus("error");
      }
    } catch {
      setParseError("Something went wrong.");
      setParseStatus("error");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          source_url: sourceUrl.trim() || undefined,
          source_title: sourceTitle.trim() || undefined,
          business_name: businessName.trim() || undefined,
          city: city.trim() || undefined,
          state: stateCode || undefined,
          industry: industry || undefined,
          size: size || undefined,
          service_signal: Array.from(services),
          raw_content: rawContent,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/pipeline/leads/${data.lead.id}`);
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.message ?? "Couldn't create lead.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Parse with Claude panel */}
      <section className="p-5 border border-accent rounded-lg bg-accent/5 space-y-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-accent mb-1">
            Parse with Claude
          </h2>
          <p className="text-xs text-muted">
            Paste a job posting / article body, or try a URL. Claude extracts business name, location, industry, size, and service signal — you review + save.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setParsePane("text")}
            className={`px-3 py-1 rounded-md border text-xs transition ${
              parsePane === "text"
                ? "border-accent bg-surface-strong"
                : "border-border text-muted hover:border-foreground/40"
            }`}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => setParsePane("url")}
            className={`px-3 py-1 rounded-md border text-xs transition ${
              parsePane === "url"
                ? "border-accent bg-surface-strong"
                : "border-border text-muted hover:border-foreground/40"
            }`}
          >
            From URL
          </button>
        </div>

        {parsePane === "text" ? (
          <textarea
            value={parseText}
            onChange={(e) => setParseText(e.target.value)}
            rows={6}
            placeholder="Paste the posting body, article text, or RFP content here."
            className={inputClasses}
          />
        ) : (
          <>
            <input
              type="url"
              value={parseUrl}
              onChange={(e) => setParseUrl(e.target.value)}
              placeholder="https://..."
              className={inputClasses}
            />
            <p className="text-xs text-muted">
              Heads up: Indeed and LinkedIn often block server fetches. If it fails, just paste the text instead.
            </p>
          </>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleParse}
            disabled={
              parseStatus === "parsing" ||
              (parsePane === "url" ? !parseUrl.trim() : !parseText.trim())
            }
            className="px-5 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {parseStatus === "parsing" ? "Parsing…" : "Parse + populate"}
          </button>
          {parseStatus === "parsed" && (
            <span className="text-xs text-muted">
              ✓ Populated below. Review and edit any field before saving.
            </span>
          )}
          {parseError && (
            <span className="text-sm text-red-600">{parseError}</span>
          )}
        </div>

        {parseSummary && (
          <p className="text-xs text-muted italic pt-2 border-t border-border">
            Claude&apos;s read: {parseSummary}
          </p>
        )}
      </section>

      <Field label="Source type" required>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as LeadSourceType)}
          className={inputClasses}
        >
          {LEAD_SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Source URL" hint="Direct link to the posting/article.">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://"
            className={inputClasses}
          />
        </Field>
        <Field label="Source title" hint='e.g. "Marketing Manager at Acme Co".'>
          <input
            type="text"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            className={inputClasses}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Business name" hint="Required to convert later — fill in when known.">
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputClasses}
          />
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
      </div>

      <Field label="Service signal" hint="What services they might need (inferred from the posting/source).">
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

      <Field label="Raw content" hint="Paste the job posting / article body / RFP text here. It stays attached to the lead and you can feed it to Claude later for parsing.">
        <textarea
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          rows={8}
          className={inputClasses}
        />
      </Field>

      <Field label="Notes" hint="Your own thoughts — why this is interesting, what angle to take.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputClasses}
        />
      </Field>

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Capture lead"}
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
