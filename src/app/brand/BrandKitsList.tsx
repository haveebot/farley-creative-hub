"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BrandKit } from "@/lib/db/brand-kits";

type CreateStatus = "idle" | "creating" | "error";

export default function BrandKitsList({ initialKits }: { initialKits: BrandKit[] }) {
  const router = useRouter();
  const [kits, setKits] = useState(initialKits);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<CreateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const studio = kits.find((k) => k.is_studio_self);
  const clients = kits.filter((k) => !k.is_studio_self);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setStatus("creating");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/brand-kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setKits([...kits, data.kit]);
        setNewName("");
        setShowForm(false);
        setStatus("idle");
        // Go straight to edit
        router.push(`/brand/${data.kit.id}`);
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.message ?? "Couldn't create kit.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this client brand kit? Any drafts referencing it will be unlinked.")) {
      return;
    }
    try {
      const res = await fetch(`/api/brand-kits/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKits(kits.filter((k) => k.id !== id));
        router.refresh();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-10">
      {/* Studio section */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
          Studio
        </h2>
        {studio ? (
          <KitCard kit={studio} />
        ) : (
          <p className="text-sm text-muted">Studio kit not yet initialized.</p>
        )}
      </section>

      {/* Clients section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Clients
          </h2>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
          >
            {showForm ? "Cancel" : "+ New client kit"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="p-4 border border-border rounded-lg bg-white/40 mb-4 flex items-end gap-3">
            <label className="flex-1">
              <span className="block text-sm mb-2">Client name</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Heye Lab, Acme Pottery"
                className="w-full px-3 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={status === "creating" || !newName.trim()}
              className="px-5 py-2 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {status === "creating" ? "Creating…" : "Create + edit"}
            </button>
            {errorMessage && (
              <span className="text-sm text-red-600">{errorMessage}</span>
            )}
          </form>
        )}

        {clients.length === 0 ? (
          <p className="text-sm text-muted p-6 border border-dashed border-border rounded-lg text-center">
            No client brand kits yet. Add one for each client you do design / brand work for — Claude can then draft in their voice when working on their projects.
          </p>
        ) : (
          <ul className="space-y-3">
            {clients.map((k) => (
              <KitCard key={k.id} kit={k} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KitCard({
  kit,
  onDelete,
}: {
  kit: BrandKit;
  onDelete?: (id: number) => void;
}) {
  return (
    <li className="p-5 border border-border rounded-lg bg-white/40 list-none">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-medium text-base">{kit.name}</h3>
            {kit.is_studio_self && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                Studio
              </span>
            )}
          </div>
          {kit.bio && (
            <p className="text-sm text-muted mb-3 line-clamp-2">{kit.bio}</p>
          )}
          <div className="flex items-center gap-2">
            {[kit.primary_color, kit.secondary_color, kit.accent_color]
              .filter(Boolean)
              .map((c, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded border border-border"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            {!kit.primary_color && !kit.secondary_color && !kit.accent_color && (
              <span className="text-xs text-muted">no palette set</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={`/brand/${kit.id}`}
            className="text-sm underline hover:text-foreground transition"
          >
            Edit
          </a>
          {onDelete && !kit.is_studio_self && (
            <button
              type="button"
              onClick={() => onDelete(kit.id)}
              className="text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
