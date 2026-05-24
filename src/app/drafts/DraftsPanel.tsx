"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DRAFT_KINDS,
  DRAFT_STATUSES,
  KIND_LABELS,
  STATUS_LABELS,
  type Draft,
  type DraftKind,
  type DraftStatus,
} from "@/lib/drafts-shared";
import type { BrandKit } from "@/lib/db/brand-kits";

type CreateStatus = "idle" | "drafting" | "error";

export default function DraftsPanel({
  initialDrafts,
  brandKits,
}: {
  initialDrafts: Draft[];
  brandKits: BrandKit[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [filterStatus, setFilterStatus] = useState<DraftStatus | "all">("all");
  const [filterKind, setFilterKind] = useState<DraftKind | "all">("all");

  const studioKit = brandKits.find((k) => k.is_studio_self);

  // Create-form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DraftKind>("listing");
  const [prompt, setPrompt] = useState("");
  const [brandKitId, setBrandKitId] = useState<string>(
    studioKit ? String(studioKit.id) : "",
  );
  const [createStatus, setCreateStatus] = useState<CreateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filtered = drafts.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterKind !== "all" && d.kind !== filterKind) return false;
    return true;
  });

  function resetForm() {
    setTitle("");
    setKind("listing");
    setPrompt("");
    setErrorMessage(null);
    setCreateStatus("idle");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;
    setCreateStatus("drafting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          kind,
          prompt: prompt.trim(),
          brand_kit_id: brandKitId ? parseInt(brandKitId, 10) : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDrafts([data.draft, ...drafts]);
        resetForm();
        setShowForm(false);
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setCreateStatus("error");
      setErrorMessage(body?.message ?? "Draft failed.");
    } catch {
      setCreateStatus("error");
      setErrorMessage("Something went wrong.");
    }
  }

  async function handleStatusChange(id: number, status: DraftStatus) {
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setDrafts(drafts.map((d) => (d.id === id ? data.draft : d)));
      }
    } catch {
      // ignore
    }
  }

  async function handleContentUpdate(id: number, content: string) {
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setDrafts(drafts.map((d) => (d.id === id ? data.draft : d)));
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this draft?")) return;
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts(drafts.filter((d) => d.id !== id));
        router.refresh();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as DraftStatus | "all")}
            className={filterClasses}
          >
            <option value="all">All statuses</option>
            {DRAFT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as DraftKind | "all")}
            className={filterClasses}
          >
            <option value="all">All kinds</option>
            {DRAFT_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
          <span className="text-xs text-muted ml-2">
            {filtered.length} of {drafts.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
        >
          {showForm ? "Cancel" : "+ New draft"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-6 border border-border rounded-lg bg-white/40 space-y-4">
          <Field label="Title" hint="A short label so you can find this draft later (not the output).">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Botanical wedding template — Etsy listing"
              className={inputClasses}
              required
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Kind">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as DraftKind)}
                className={inputClasses}
              >
                {DRAFT_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Voice" hint="Which brand voice Claude will draft in.">
              <select
                value={brandKitId}
                onChange={(e) => setBrandKitId(e.target.value)}
                className={inputClasses}
              >
                {brandKits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} {k.is_studio_self ? "(studio)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Prompt" hint="What do you want Claude to draft? Be as specific or loose as you want — Claude grounds in your brand voice + brand book notes either way.">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="e.g. New Etsy listing for a watercolor botanical wedding invitation template. Editable in Canva. Includes save the date, invite, RSVP card. Aimed at brides planning outdoor garden weddings."
              className={inputClasses}
              required
            />
          </Field>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={createStatus === "drafting" || !title.trim() || !prompt.trim()}
              className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {createStatus === "drafting" ? "Drafting…" : "Draft with Claude"}
            </button>
            {createStatus === "error" && errorMessage && (
              <span className="text-sm text-red-600">{errorMessage}</span>
            )}
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          {drafts.length === 0
            ? "No drafts yet. Create your first one above, or draft from Claude Code via MCP."
            : "No drafts match the current filters."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <DraftRow
              key={d.id}
              draft={d}
              onStatusChange={handleStatusChange}
              onContentUpdate={handleContentUpdate}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftRow({
  draft,
  onStatusChange,
  onContentUpdate,
  onDelete,
}: {
  draft: Draft;
  onStatusChange: (id: number, status: DraftStatus) => void;
  onContentUpdate: (id: number, content: string) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(draft.content);

  const updated = new Date(draft.updated_at).toLocaleString();

  async function saveEdit() {
    onContentUpdate(draft.id, editContent);
    setEditing(false);
  }

  return (
    <li className="border border-border rounded-lg bg-white/40">
      <div className="p-4 flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-left flex-1 min-w-0"
        >
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h3 className="font-medium truncate">{draft.title}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-muted">
              {KIND_LABELS[draft.kind as DraftKind] ?? draft.kind}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-muted">
              {STATUS_LABELS[draft.status as DraftStatus] ?? draft.status}
            </span>
          </div>
          {!expanded && draft.content && (
            <p className="text-sm text-muted line-clamp-2">{draft.content}</p>
          )}
          <p className="text-xs text-muted mt-1">
            {updated} · by {draft.created_by}
            {draft.model_used && ` · ${draft.model_used}`}
          </p>
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {draft.prompt && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer hover:text-foreground">Show prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans bg-white/40 p-3 rounded border border-border">{draft.prompt}</pre>
            </details>
          )}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={Math.max(8, editContent.split("\n").length + 1)}
                className={`${inputClasses} font-mono text-sm`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditContent(draft.content);
                  }}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm bg-white/40 p-4 rounded border border-border">{draft.content}</pre>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            {!editing && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(draft.content);
                    setEditing(true);
                  }}
                  className="px-3 py-1.5 text-sm border border-border rounded hover:bg-white/60 transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(draft.content)}
                  className="px-3 py-1.5 text-sm border border-border rounded hover:bg-white/60 transition"
                >
                  Copy
                </button>
              </>
            )}
            <select
              value={draft.status}
              onChange={(e) => onStatusChange(draft.id, e.target.value as DraftStatus)}
              className="px-3 py-1.5 text-sm border border-border rounded bg-transparent"
            >
              {DRAFT_STATUSES.map((s) => (
                <option key={s} value={s}>Status: {STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="text-sm text-red-600 hover:underline ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

const inputClasses =
  "w-full px-4 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition";

const filterClasses =
  "px-3 py-1.5 bg-transparent border border-border rounded-md text-sm";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {hint && <span className="block text-xs text-muted mb-2">{hint}</span>}
      {children}
    </label>
  );
}
