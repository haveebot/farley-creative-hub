"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ACTIVITY_KIND_LABELS,
  CONTACT_ROLE_LABELS,
  CONTACT_ROLES,
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
  type ActivityKind,
  type ContactRole,
  type Prospect,
  type ProspectActivityRow,
  type ProspectContact,
  type ProspectIndustry,
  type ProspectSize,
  type ProspectSource,
  type ProspectStatus,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

const ACTIVITY_KINDS = Object.keys(ACTIVITY_KIND_LABELS) as ActivityKind[];

export default function ProspectDetail({
  initialProspect,
  initialContacts,
  initialActivity,
}: {
  initialProspect: Prospect;
  initialContacts: ProspectContact[];
  initialActivity: ProspectActivityRow[];
}) {
  const router = useRouter();
  const [prospect, setProspect] = useState(initialProspect);
  const [contacts, setContacts] = useState(initialContacts);
  const [activity, setActivity] = useState(initialActivity);

  async function updateField(updates: Partial<Prospect>) {
    const res = await fetch(`/api/prospects/${prospect.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setProspect(data.prospect);
      router.refresh();
    }
  }

  async function handleDeleteProspect() {
    if (!confirm("Delete this prospect and all its contacts and activity?")) return;
    const res = await fetch(`/api/prospects/${prospect.id}`, { method: "DELETE" });
    if (res.ok) router.push("/pipeline");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left two cols: details + activity */}
      <div className="lg:col-span-2 space-y-6">
        <DetailsCard prospect={prospect} onUpdate={updateField} />
        <ActivityCard
          prospectId={prospect.id}
          activity={activity}
          onAdd={(row) => setActivity([row, ...activity])}
        />
      </div>

      {/* Right col: contacts + danger zone */}
      <div className="space-y-6">
        <ContactsCard
          prospectId={prospect.id}
          contacts={contacts}
          onChange={setContacts}
        />
        <div className="p-5 border border-border rounded-lg bg-surface text-sm">
          <button
            type="button"
            onClick={handleDeleteProspect}
            className="text-sm text-red-600 hover:underline"
          >
            Delete prospect
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsCard({
  prospect,
  onUpdate,
}: {
  prospect: Prospect;
  onUpdate: (updates: Partial<Prospect>) => void;
}) {
  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-4">
        Details
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InlineSelect
          label="Status"
          value={prospect.status}
          options={PROSPECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(v) => onUpdate({ status: v as ProspectStatus })}
        />
        <InlineSelect
          label="Source"
          value={prospect.source ?? ""}
          allowEmpty
          options={PROSPECT_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
          onChange={(v) => onUpdate({ source: (v || null) as ProspectSource | null })}
        />
        <InlineSelect
          label="Industry"
          value={prospect.industry ?? ""}
          allowEmpty
          options={PROSPECT_INDUSTRIES.map((i) => ({ value: i, label: INDUSTRY_LABELS[i] }))}
          onChange={(v) => onUpdate({ industry: (v || null) as ProspectIndustry | null })}
        />
        <InlineSelect
          label="Size"
          value={prospect.size ?? ""}
          allowEmpty
          options={PROSPECT_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s] }))}
          onChange={(v) => onUpdate({ size: (v || null) as ProspectSize | null })}
        />
        <InlineText
          label="City"
          value={prospect.city ?? ""}
          onSave={(v) => onUpdate({ city: v || null })}
        />
        <InlineSelect
          label="State"
          value={prospect.state ?? ""}
          allowEmpty
          options={US_STATES.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }))}
          onChange={(v) => onUpdate({ state: v || null })}
        />
        <InlineText
          label="Website"
          value={prospect.website_url ?? ""}
          onSave={(v) => onUpdate({ website_url: v || null })}
          fullWidth
        />
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <label className="block text-sm font-medium mb-1">Service interest</label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_INTERESTS.map((s) => {
            const on = prospect.service_interest.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const next = on
                    ? prospect.service_interest.filter((x) => x !== s)
                    : [...prospect.service_interest, s];
                  onUpdate({ service_interest: next as ServiceInterest[] });
                }}
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

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
        <InlineText
          label="Next action"
          value={prospect.next_action ?? ""}
          onSave={(v) => onUpdate({ next_action: v || null })}
        />
        <InlineText
          label="Next action date"
          value={prospect.next_action_date ?? ""}
          type="date"
          onSave={(v) => onUpdate({ next_action_date: v || null })}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <InlineText
          label="Notes"
          value={prospect.notes}
          onSave={(v) => onUpdate({ notes: v })}
          multiline
        />
      </div>
    </section>
  );
}

function ContactsCard({
  prospectId,
  contacts,
  onChange,
}: {
  prospectId: number;
  contacts: ProspectContact[];
  onChange: (c: ProspectContact[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<ContactRole | "">("");
  const [isPrimary, setIsPrimary] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch(`/api/prospects/${prospectId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role: role || undefined,
        is_primary: isPrimary,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      onChange([data.contact, ...contacts]);
      setName("");
      setEmail("");
      setPhone("");
      setRole("");
      setIsPrimary(false);
      setShowForm(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this contact?")) return;
    const res = await fetch(`/api/prospects/${prospectId}/contacts/${id}`, {
      method: "DELETE",
    });
    if (res.ok) onChange(contacts.filter((c) => c.id !== id));
  }

  async function handlePromote(id: number) {
    const res = await fetch(`/api/prospects/${prospectId}/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
    });
    if (res.ok) {
      onChange(
        contacts.map((c) => ({ ...c, is_primary: c.id === id })),
      );
    }
  }

  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Contacts
        </h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="text-xs underline hover:text-foreground"
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 text-sm">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className={inputClasses}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClasses}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className={inputClasses}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ContactRole | "")}
            className={inputClasses}
          >
            <option value="">Role (optional)</option>
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r}>{CONTACT_ROLE_LABELS[r]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Primary contact
          </label>
          <button
            type="submit"
            className="w-full px-3 py-1.5 bg-accent text-white rounded-md text-sm font-medium"
          >
            Add
          </button>
        </form>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-muted">No contacts yet.</p>
      ) : (
        <ul className="space-y-3">
          {contacts.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.name}</span>
                    {c.is_primary && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                        Primary
                      </span>
                    )}
                  </div>
                  {c.role && (
                    <p className="text-xs text-muted">{CONTACT_ROLE_LABELS[c.role] ?? c.role}</p>
                  )}
                  {c.email && (
                    <p className="text-xs text-muted truncate">
                      <a href={`mailto:${c.email}`} className="underline">{c.email}</a>
                    </p>
                  )}
                  {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!c.is_primary && (
                    <button
                      type="button"
                      onClick={() => handlePromote(c.id)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityCard({
  prospectId,
  activity,
  onAdd,
}: {
  prospectId: number;
  activity: ProspectActivityRow[];
  onAdd: (row: ProspectActivityRow) => void;
}) {
  const [kind, setKind] = useState<ActivityKind>("note");
  const [content, setContent] = useState("");

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && kind !== "call") return;
    const res = await fetch(`/api/prospects/${prospectId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content: content.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      onAdd(data.activity);
      setContent("");
    }
  }

  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
        Activity
      </h2>

      <form onSubmit={handleLog} className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ActivityKind)}
            className={`${inputClasses} text-sm w-auto`}
          >
            {ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>{ACTIVITY_KIND_LABELS[k]}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium"
          >
            Log
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="What happened? (optional for calls)"
          className={`${inputClasses} text-sm`}
        />
      </form>

      {activity.length === 0 ? (
        <p className="text-sm text-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="text-sm border-l-2 border-border pl-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{ACTIVITY_KIND_LABELS[a.kind] ?? a.kind}</span>
                <span className="text-xs text-muted">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              {a.content && <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{a.content}</p>}
              <p className="text-xs text-muted mt-1">{a.created_by}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============ Inline-edit helpers ============

function InlineText({
  label,
  value,
  onSave,
  type = "text",
  multiline = false,
  fullWidth = false,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
  multiline?: boolean;
  fullWidth?: boolean;
}) {
  const [v, setV] = useState(value);
  const dirty = v !== value;

  return (
    <label className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
      <span className="block text-xs text-muted mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => dirty && onSave(v)}
          rows={3}
          className={inputClasses}
        />
      ) : (
        <input
          type={type}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => dirty && onSave(v)}
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
