"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type Lead,
  type LeadContact,
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
type FirstTouchStatus = "idle" | "drafting" | "drafted" | "error";

type FirstTouchResult = {
  analysis: { role: string; constraint: string; lever: string };
  subject: string;
  body: string;
  gmail: { draftId: string; gmailUrl: string; sender: string };
  source: { origin: string; chars: number; fetch_failed?: boolean };
};

export default function LeadDetail({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [convertStatus, setConvertStatus] = useState<ConvertStatus>("idle");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [firstTouchStatus, setFirstTouchStatus] = useState<FirstTouchStatus>("idle");
  const [firstTouchError, setFirstTouchError] = useState<string | null>(null);
  const [firstTouchResult, setFirstTouchResult] = useState<FirstTouchResult | null>(null);

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

  async function handleFirstTouch() {
    setFirstTouchStatus("drafting");
    setFirstTouchError(null);
    setFirstTouchResult(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-first-touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setFirstTouchError(data.message ?? data.error ?? "Draft failed.");
        setFirstTouchStatus("error");
        return;
      }
      setFirstTouchResult(data);
      setFirstTouchStatus("drafted");
      if (data.lead) setLead(data.lead);
      router.refresh();
    } catch (err) {
      setFirstTouchError((err as Error).message);
      setFirstTouchStatus("error");
    }
  }

  const alreadyConverted = lead.status === "converted" && lead.converted_to_prospect_id;
  const contentIsThin = (lead.raw_content?.length ?? 0) < 600;
  const alreadyDrafted = !!lead.first_touch_gmail_draft_id;
  const gmailDraftUrl = firstTouchResult?.gmail.gmailUrl ?? null;

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
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleFirstTouch}
            disabled={firstTouchStatus === "drafting"}
            className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            title="Generate a custom first-touch email from the JD — auto-promotes lead to prospect on first run; subsequent runs re-draft with the latest brand voice + roster"
          >
            {firstTouchStatus === "drafting"
              ? "Preparing…"
              : alreadyDrafted
                ? "Re-draft first-touch"
                : "Draft first-touch"}
          </button>
          {alreadyConverted ? (
            <a
              href={`/pipeline/${lead.converted_to_prospect_id}`}
              className="px-4 py-2 border border-accent text-accent rounded-md text-sm font-medium hover:bg-accent hover:text-white transition"
            >
              Open prospect →
            </a>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={convertStatus === "converting"}
              className="px-4 py-2 border border-accent text-accent rounded-md text-sm font-medium hover:bg-accent hover:text-white transition disabled:opacity-50"
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
      {firstTouchError && (
        <p className="text-sm text-red-600 -mt-3">First-touch: {firstTouchError}</p>
      )}

      {/* FIRST-TOUCH RESULT — drafted email landed in Gmail. Lead stays a
          lead; operator promotes via the existing Convert button after
          they actually send the email. */}
      {(firstTouchResult || alreadyDrafted) && (
        <section className="p-5 border-2 border-green-500/30 rounded-lg bg-green-500/5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-green-700 dark:text-green-400 mb-1">
                First-touch drafted ✓
              </p>
              <p className="text-base font-medium">
                {firstTouchResult?.subject ?? lead.first_touch_subject ?? "(draft created)"}
              </p>
              {lead.first_touch_drafted_at && (
                <p className="text-xs text-muted mt-1">
                  Drafted {new Date(lead.first_touch_drafted_at).toLocaleString()} · JD via{" "}
                  {firstTouchResult?.source.origin ?? lead.first_touch_jd_source ?? "unknown"}
                </p>
              )}
            </div>
            {(gmailDraftUrl ?? lead.first_touch_gmail_draft_id) && (
              <a
                href={
                  gmailDraftUrl ??
                  `https://mail.google.com/mail/u/0/#drafts?compose=${lead.first_touch_gmail_draft_id}`
                }
                target="_blank"
                rel="noreferrer noopener"
                className="px-5 py-2.5 bg-green-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition shrink-0 inline-flex items-center gap-2"
              >
                Open Gmail Draft <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
          {firstTouchResult && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-surface rounded border border-border">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Role read</p>
                  <p className="text-foreground/90">{firstTouchResult.analysis.role}</p>
                </div>
                <div className="p-3 bg-surface rounded border border-border">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Constraint</p>
                  <p className="text-foreground/90">{firstTouchResult.analysis.constraint}</p>
                </div>
                <div className="p-3 bg-surface rounded border border-border">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Lever</p>
                  <p className="text-foreground/90">{firstTouchResult.analysis.lever}</p>
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                  Show body preview
                </summary>
                <pre className="mt-3 p-4 bg-surface rounded border border-border whitespace-pre-wrap font-sans text-sm">
                  {firstTouchResult.body}
                </pre>
              </details>
            </>
          )}

          {/* Roster — reads from PERSISTED lead.contacts so it survives
              refreshes + works across machines. Operator edits emails inline. */}
          {lead.contacts && lead.contacts.length > 0 && (
            <RosterPicker
              leadId={lead.id}
              websiteUrl={lead.website_url}
              initialContacts={lead.contacts}
              subject={firstTouchResult?.subject ?? lead.first_touch_subject ?? ""}
              body={firstTouchResult?.body ?? lead.first_touch_body ?? ""}
              onApplied={(newUrl, savedContacts) => {
                if (firstTouchResult) {
                  setFirstTouchResult({
                    ...firstTouchResult,
                    gmail: { ...firstTouchResult.gmail, gmailUrl: newUrl },
                  });
                }
                setLead({ ...lead, contacts: savedContacts });
              }}
            />
          )}
          {(!lead.contacts || lead.contacts.length === 0) && firstTouchResult && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ No roster — enrichment didn&apos;t find any contacts on the company website.
              {lead.enrichment_notes && ` (${lead.enrichment_notes})`}
            </p>
          )}
        </section>
      )}

      {/* PROMINENT SOURCE — at the top, where the eye lands first */}
      {lead.source_url && (
        <section className="p-5 border-2 border-accent/30 rounded-lg bg-accent/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-accent mb-1">
                Source posting
              </p>
              {lead.source_title && (
                <p className="text-base font-medium truncate" title={lead.source_title}>
                  {lead.source_title}
                </p>
              )}
              <p
                className="text-xs text-muted truncate"
                title={lead.source_url}
              >
                {hostnameOf(lead.source_url)}
              </p>
            </div>
            <a
              href={lead.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="px-5 py-2.5 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition shrink-0 inline-flex items-center gap-2"
            >
              Open full posting <span aria-hidden="true">↗</span>
            </a>
          </div>
          {contentIsThin && (
            <PasteToEnrich
              leadId={lead.id}
              onEnriched={(updated) => setLead(updated)}
            />
          )}
        </section>
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * When a lead's raw_content is suspiciously short (digest snippet only),
 * surface a paste-and-enrich affordance: operator opens the source URL,
 * copies the full posting body, pastes here, AI re-parses + backfills
 * structured fields without clobbering operator edits.
 */
function PasteToEnrich({
  leadId,
  onEnriched,
}: {
  leadId: number;
  onEnriched: (lead: Lead) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    if (text.trim().length < 100) {
      setError("Paste at least ~100 chars of the posting body.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Enrichment failed");
        return;
      }
      onEnriched(data.lead);
      const filled = (data.enriched?.fields_backfilled ?? []) as string[];
      setResult(
        filled.length > 0
          ? `Enriched — backfilled: ${filled.join(", ")}.`
          : "Raw content updated.",
      );
      setText("");
      setExpanded(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-accent/30">
      {!expanded ? (
        <div className="flex items-start gap-3 flex-wrap">
          <p className="text-xs text-muted leading-relaxed flex-1 min-w-0">
            <strong className="text-foreground/80">Content looks thin.</strong>{" "}
            Most digest sources (Indeed, LinkedIn) block server-side fetching,
            so we couldn&apos;t auto-pull the full posting body. Paste it here
            once and the AI fills in the structured fields.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs underline text-accent hover:text-foreground shrink-0"
          >
            + Paste full posting →
          </button>
          {result && (
            <p className="text-xs text-accent italic mt-1">{result}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste the full job posting / RFP / article body here…"
            className="w-full px-3 py-2 bg-transparent border border-border rounded-md text-sm focus:outline-none focus:border-accent transition font-mono"
            autoFocus
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || text.length < 100}
              className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              {submitting ? "Enriching…" : "Enrich lead →"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError(null);
                setText("");
              }}
              className="text-xs text-muted underline hover:text-foreground"
            >
              Cancel
            </button>
            <span className="text-xs text-muted ml-auto">
              {text.length.toLocaleString()} chars
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RosterPicker — operator picks recipients + edits emails inline, then
 * back-fills selected to the existing Gmail draft.
 *
 * Reads from PERSISTED lead.contacts (initialContacts prop) so the roster
 * survives refreshes and works across machines. Email edits are saved
 * back to lead.contacts when operator clicks Apply.
 *
 * No email guessing — operator types in any missing emails manually from
 * their own research (contact page, LinkedIn, etc.).
 */
function RosterPicker({
  leadId,
  websiteUrl,
  initialContacts,
  subject,
  body,
  onApplied,
}: {
  leadId: number;
  websiteUrl: string | null;
  initialContacts: LeadContact[];
  subject: string;
  body: string;
  onApplied: (gmailUrl: string, savedContacts: LeadContact[]) => void;
}) {
  // Local state mirrors lead.contacts but with editable emails.
  const [contacts, setContacts] = useState<LeadContact[]>(initialContacts);
  // Default include: all contacts that already have an email.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialContacts.map((c, i) => (c.email ? i : -1)).filter((i) => i >= 0)),
  );
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setEmail(i: number, email: string) {
    const next = [...contacts];
    next[i] = { ...next[i], email: email.trim() || null };
    setContacts(next);
    setApplied(false);
    // If they typed an email into a previously-empty row, auto-check it.
    if (email.trim() && !selected.has(i)) {
      const nextSel = new Set(selected);
      nextSel.add(i);
      setSelected(nextSel);
    }
    // If they cleared an email, uncheck.
    if (!email.trim() && selected.has(i)) {
      const nextSel = new Set(selected);
      nextSel.delete(i);
      setSelected(nextSel);
    }
  }

  function toggle(i: number) {
    if (!contacts[i].email) return;
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
    setApplied(false);
  }

  const picked = Array.from(selected)
    .map((i) => contacts[i])
    .filter((c) => c && c.email);

  async function apply() {
    if (picked.length === 0) {
      setError("Need at least one contact with an email.");
      return;
    }
    if (!body) {
      setError("Email body is missing — re-run Draft first-touch.");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/set-recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: picked.map((c) => ({ email: c.email!, name: c.name })),
          subject,
          body,
          contacts, // persist edited emails back to lead.contacts
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Apply failed");
        return;
      }
      onApplied(data.gmail.gmailUrl, contacts);
      setApplied(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="border border-border rounded-lg bg-surface p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted mb-1">Roster</p>
        <p className="text-sm text-foreground/80">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          {websiteUrl && (
            <>
              {" "}from{" "}
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-foreground"
              >
                {new URL(websiteUrl).hostname}
              </a>
            </>
          )}
        </p>
        <p className="text-xs text-muted mt-1">
          Sage multi-TO pattern — all checked contacts go on the To: line of one Gmail draft. Type missing emails inline (no guessing — paste from your own research).
        </p>
      </div>

      <ul className="divide-y divide-border">
        {contacts.map((c, i) => {
          const isSelected = selected.has(i);
          return (
            <li key={`${c.name}-${i}`} className="py-2.5 space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="checkbox"
                  id={`roster-${i}`}
                  checked={isSelected}
                  disabled={!c.email}
                  onChange={() => toggle(i)}
                  className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                />
                <label htmlFor={`roster-${i}`} className="min-w-0 flex-1 cursor-pointer">
                  <p className="text-sm font-medium">
                    {c.name}
                    {c.is_ai_top_pick && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-accent">
                        AI top pick
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted truncate">{c.title || "(no title)"}</p>
                </label>
              </div>
              <div className="pl-7">
                <input
                  type="email"
                  value={c.email ?? ""}
                  onChange={(e) => setEmail(i, e.target.value)}
                  placeholder="Type email (e.g. firstname@company.com)"
                  className="w-full px-2 py-1 text-xs bg-transparent border border-border rounded font-mono focus:outline-none focus:border-accent transition"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border">
        <p className="text-xs text-muted">
          {picked.length} of {contacts.length} selected
          {picked.length === 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {" "}· need ≥1 with email
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={apply}
          disabled={applying || picked.length === 0}
          className="px-5 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {applying
            ? "Adding…"
            : applied
              ? "Added ✓"
              : `Add ${picked.length} recipient${picked.length !== 1 ? "s" : ""} to Gmail draft`}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
