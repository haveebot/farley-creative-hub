"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASSET_KINDS, formatSize, type Asset, type AssetKind } from "@/lib/db/assets";
import type { BrandKit } from "@/lib/db/brand-kits";

const KIND_LABELS: Record<AssetKind, string> = {
  general: "General",
  logo: "Logo",
  brand_book: "Brand book",
  design_master: "Design master",
  design_export: "Design export",
};

type UploadStatus = "idle" | "uploading" | "error";

export default function AssetsPanel({
  initialAssets,
  brandKits,
}: {
  initialAssets: Asset[];
  brandKits: BrandKit[];
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AssetKind>("general");
  const [brandKitId, setBrandKitId] = useState<string>("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setFile(null);
    setName("");
    setKind("general");
    setBrandKitId("");
    setDescription("");
    setErrorMessage(null);
    setStatus("idle");
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setErrorMessage(null);

    const form = new FormData();
    form.append("file", file);
    if (name.trim()) form.append("name", name.trim());
    form.append("kind", kind);
    if (brandKitId) form.append("brand_kit_id", brandKitId);
    if (description.trim()) form.append("description", description.trim());

    try {
      const res = await fetch("/api/assets", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setAssets([data.asset, ...assets]);
        resetForm();
        setShowForm(false);
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.message ?? "Upload failed.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Try again.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this asset? The file is removed from storage too.")) return;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssets(assets.filter((a) => a.id !== id));
        router.refresh();
      }
    } catch {
      // ignore — UI just won't update
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {assets.length} {assets.length === 1 ? "asset" : "assets"}
        </p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
        >
          {showForm ? "Cancel" : "+ Upload asset"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="p-6 border border-border rounded-lg bg-white/40 space-y-4">
          <Field label="File" required>
            <input
              type="file"
              required
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
              }}
              className="block w-full text-sm"
            />
            {file && (
              <p className="text-xs text-muted mt-1">
                {file.name} · {formatSize(file.size)} · {file.type || "unknown type"}
              </p>
            )}
          </Field>

          <Field label="Friendly name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What to call this asset in the Hub"
              className={inputClasses}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Kind">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as AssetKind)}
                className={inputClasses}
              >
                {ASSET_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Linked brand kit (optional)">
              <select
                value={brandKitId}
                onChange={(e) => setBrandKitId(e.target.value)}
                className={inputClasses}
              >
                <option value="">— None (general library)</option>
                {brandKits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} {k.is_studio_self ? "(studio)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Anything helpful — version, context, what it's for"
              className={inputClasses}
            />
          </Field>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={status === "uploading" || !file}
              className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {status === "uploading" ? "Uploading…" : "Upload"}
            </button>
            {errorMessage && (
              <span className="text-sm text-red-600">{errorMessage}</span>
            )}
          </div>
        </form>
      )}

      {assets.length === 0 ? (
        <p className="text-sm text-muted p-8 border border-dashed border-border rounded-lg text-center">
          No assets yet. Upload your first one to get started.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a) => {
            const brand = brandKits.find((k) => k.id === a.brand_kit_id);
            return (
              <li key={a.id} className="p-4 border border-border rounded-lg bg-white/40">
                <div className="aspect-video mb-3 bg-white/40 rounded overflow-hidden flex items-center justify-center text-3xl text-muted">
                  {a.mime_type.startsWith("image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  ) : a.mime_type === "application/pdf" ? (
                    <span>📄</span>
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mb-1 gap-2">
                  <h3 className="font-medium text-sm truncate">{a.name}</h3>
                  <span className="text-xs text-muted shrink-0">{formatSize(a.size_bytes)}</span>
                </div>
                <p className="text-xs text-muted mb-2">
                  {KIND_LABELS[a.kind as AssetKind] ?? a.kind}
                  {brand && ` · ${brand.name}`}
                </p>
                {a.description && (
                  <p className="text-xs text-muted mb-2 line-clamp-2">{a.description}</p>
                )}
                <div className="flex items-center gap-3 pt-2 border-t border-border text-xs">
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="text-red-600 hover:underline ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
