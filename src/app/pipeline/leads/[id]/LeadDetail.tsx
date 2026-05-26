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
type PopulateStatus = "idle" | "populating" | "populated" | "error";

type FirstTouchResult = {
  analysis: { role: string; constraint: string; lever: string };
  subject: string;
  body: string;
  recipients: Array<{ email: string; name?: string | null }>;
  gmail: { draftId: string; gmailUrl: string; sender: string };
  source: { origin: string; chars: number; fetch_failed?: boolean };
};

/** Local roster state — mirrors lead.contacts with operator edits.
 *  Per-row include flag + editable email. */
type RosterRow = LeadContact & { include: boolean };

export default function LeadDetail({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [convertStatus, setConvertStatus] = useState<ConvertStatus>("idle");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [firstTouchStatus, setFirstTouchStatus] = useState<FirstTouchStatus>("idle");
  const [firstTouchError, setFirstTouchError] = useState<string | null>(null);
  const [firstTouchResult, setFirstTouchResult] = useState<FirstTouchResult | null>(null);
  const [populateStatus, setPopulateStatus] = useState<PopulateStatus>("idle");
  const [populateError, setPopulateError] = useState<string | null>(null);

  // Local roster state — derived from lead.contacts on load, edited inline.
  const [roster, setRoster] = useState<RosterRow[]>(() =>
    (initialLead.contacts ?? []).map((c) => ({ ...c, include: !!c.email })),
  );

  // If lead.contacts changes (e.g., after populate), reset roster to it.
  // We compare a fingerprint to avoid resetting on every render.
  const contactsFingerprint = JSON.stringify(lead.contacts ?? []);
  const [lastSyncedFingerprint, setLastSyncedFingerprint] = useState(contactsFingerprint);
  if (contactsFingerprint !== lastSyncedFingerprint) {
    setRoster((lead.contacts ?? []).map((c) => ({ ...c, include: !!c.email })));
    setLastSyncedFingerprint(contactsFingerprint);
  }

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

  async function handlePopulateRoster() {
    setPopulateStatus("populating");
    setPopulateError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/populate-roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setPopulateError(data.message ?? data.error ?? "Populate failed.");
        setPopulateStatus("error");
        return;
      }
      setPopulateStatus("populated");
      if (data.lead) setLead(data.lead); // triggers roster re-sync via fingerprint
      router.refresh();
    } catch (err) {
      setPopulateError((err as Error).message);
      setPopulateStatus("error");
    }
  }

  async function handleFirstTouch() {
    const picked = roster.filter((r) => r.include && r.email);
    if (picked.length === 0) {
      setFirstTouchError("Pick at least one recipient from the roster.");
      setFirstTouchStatus("error");
      return;
    }
    setFirstTouchStatus("drafting");
    setFirstTouchError(null);
    setFirstTouchResult(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-first-touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: picked.map((r) => ({ email: r.email!, name: r.name })),
          // Persist any operator email edits back to lead.contacts
          contacts: roster.map((r) => ({
            name: r.name,
            title: r.title,
            email: r.email,
            source_url: r.source_url,
            notes: r.notes,
            is_ai_top_pick: r.is_ai_top_pick,
          })),
        }),
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

  function setRosterEmail(i: number, email: string) {
    const next = [...roster];
    next[i] = { ...next[i], email: email.trim() || null, include: !!email.trim() || next[i].include };
    setRoster(next);
  }

  function toggleRosterInclude(i: number) {
    if (!roster[i].email) return;
    const next = [...roster];
    next[i] = { ...next[i], include: !next[i].include };
    setRoster(next);
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
          {lead.status !== "dismissed" && lead.status !== "converted" && (
            <button
              type="button"
              onClick={async () => {
                await update({ status: "dismissed" });
                router.push("/pipeline/leads");
              }}
              className="px-4 py-2 border border-border text-muted rounded-md text-sm font-medium hover:border-amber-600 hover:text-amber-700 dark:hover:text-amber-400 transition"
              title="Pass on this lead — moves to Dismissed (hidden from default view; reversible via the Dismissed filter)"
            >
              Pass on lead
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline ml-auto"
            title="Delete permanently — only for spam, duplicates, or parser errors. For 'no thanks' use Pass."
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

      {/* OUTREACH PANEL — two ordered actions: Populate roster, then Draft. */}
      <section className="p-5 border-2 border-accent/30 rounded-lg bg-accent/5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent mb-1">
              Outreach
            </p>
            <p className="text-sm text-foreground/80">
              {roster.length === 0
                ? "Step 1: populate the roster from the company website. Step 2: pick recipients, draft the email — recipients land on the To: line of the first Gmail draft, no back-fill."
                : `${roster.length} contact${roster.length !== 1 ? "s" : ""} in the roster. Pick recipients below, then Draft first-touch.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePopulateRoster}
            disabled={populateStatus === "populating"}
            className="px-4 py-2 border border-accent text-accent rounded-md text-sm font-medium hover:bg-accent hover:text-white transition disabled:opacity-50 shrink-0"
          >
            {populateStatus === "populating"
              ? "Enriching…"
              : roster.length > 0
                ? "Re-populate roster"
                : "Populate roster"}
          </button>
        </div>

        {populateError && <p className="text-xs text-red-600">{populateError}</p>}

        {/* Roster checkboxes + editable emails */}
        {roster.length > 0 && (
          <div className="border border-border rounded bg-surface p-4 space-y-3">
            <p className="text-xs text-muted">
              Edit emails inline for any contact AI couldn&apos;t extract. Sage multi-TO pattern — all checked contacts land on the To: line of the Gmail draft.
            </p>
            <ul className="divide-y divide-border">
              {roster.map((c, i) => (
                <li key={`${c.name}-${i}`} className="py-2.5 space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="checkbox"
                      id={`roster-${i}`}
                      checked={c.include}
                      disabled={!c.email}
                      onChange={() => toggleRosterInclude(i)}
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
                      onChange={(e) => setRosterEmail(i, e.target.value)}
                      placeholder="Type email (e.g. firstname@company.com)"
                      className="w-full px-2 py-1 text-xs bg-transparent border border-border rounded font-mono focus:outline-none focus:border-accent transition"
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border">
              <p className="text-xs text-muted">
                {roster.filter((r) => r.include && r.email).length} of {roster.length} selected
                {roster.filter((r) => r.include && r.email).length === 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}· need ≥1 with email
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={handleFirstTouch}
                disabled={
                  firstTouchStatus === "drafting" ||
                  roster.filter((r) => r.include && r.email).length === 0
                }
                className="px-5 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {firstTouchStatus === "drafting"
                  ? "Drafting…"
                  : alreadyDrafted
                    ? `Re-draft first-touch (${roster.filter((r) => r.include && r.email).length})`
                    : `Draft first-touch (${roster.filter((r) => r.include && r.email).length})`}
              </button>
            </div>
          </div>
        )}

        {/* Drafted state — Gmail link + analysis */}
        {(firstTouchResult || alreadyDrafted) && (
          <div className="p-4 border border-green-500/30 rounded bg-green-500/5 space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-green-700 dark:text-green-400 mb-1">
                  Gmail draft ready ✓ {firstTouchResult ? `(${firstTouchResult.recipients.length} on To:)` : ""}
                </p>
                <p className="text-sm font-medium">
                  {firstTouchResult?.subject ?? lead.first_touch_subject ?? "(draft)"}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-surface rounded border border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Role read</p>
                    <p className="text-foreground/90">{firstTouchResult.analysis.role}</p>
                  </div>
                  <div className="p-2 bg-surface rounded border border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Constraint</p>
                    <p className="text-foreground/90">{firstTouchResult.analysis.constraint}</p>
                  </div>
                  <div className="p-2 bg-surface rounded border border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Lever</p>
                    <p className="text-foreground/90">{firstTouchResult.analysis.lever}</p>
                  </div>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                    Show body preview
                  </summary>
                  <pre className="mt-2 p-3 bg-surface rounded border border-border whitespace-pre-wrap font-sans text-xs">
                    {firstTouchResult.body}
                  </pre>
                </details>
              </>
            )}
          </div>
        )}
      </section>

      {/* PROMINENT SOURCE + COMPANY WEBSITE — at the top, where the eye lands first */}
      {lead.source_url && (
        <section className="p-5 border-2 border-accent/30 rounded-lg bg-accent/5 space-y-4">
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

      {/* COMPANY WEBSITE — discovered during enrichment OR manually set.
          Operator can click through to verify contacts / find emails. */}
      <section className="p-5 border border-border rounded-lg bg-surface space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Company website
            </p>
            {lead.website_url ? (
              <a
                href={lead.website_url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-base font-medium text-accent hover:underline truncate inline-block max-w-full"
                title={lead.website_url}
              >
                {hostnameOf(lead.website_url)} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <p className="text-sm text-muted italic">
                Not set — will be discovered on Draft first-touch, or set manually below.
              </p>
            )}
          </div>
          {lead.website_url && (
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`${lead.website_url.replace(/\/$/, "")}/contact-us`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs px-3 py-1.5 border border-border rounded hover:border-accent hover:text-accent transition"
              >
                /contact-us
              </a>
              <a
                href={`${lead.website_url.replace(/\/$/, "")}/team`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs px-3 py-1.5 border border-border rounded hover:border-accent hover:text-accent transition"
              >
                /team
              </a>
              <a
                href={`${lead.website_url.replace(/\/$/, "")}/about`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs px-3 py-1.5 border border-border rounded hover:border-accent hover:text-accent transition"
              >
                /about
              </a>
            </div>
          )}
        </div>
        <InlineText
          label="Override URL"
          value={lead.website_url ?? ""}
          onSave={(v) => update({ website_url: v.trim() || null } as Partial<Lead>)}
        />
      </section>

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
