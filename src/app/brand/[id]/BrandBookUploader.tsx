"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "uploading" | "success" | "error";

export default function BrandBookUploader({ kitId }: { kitId: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setMessage(null);

    const form = new FormData();
    form.append("file", file);
    form.append("mode", mode);

    try {
      const res = await fetch(`/api/brand-kits/${kitId}/brand-book`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        setStatus("success");
        setMessage(
          `Extracted ${data.extraction.charsExtracted.toLocaleString()} characters from ${data.extraction.numPages} pages. PDF also saved to Assets.`,
        );
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById("brand-book-file") as HTMLInputElement | null;
        if (fileInput) fileInput.value = "";
        router.refresh();
        setTimeout(() => setStatus("idle"), 5000);
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus("error");
      setMessage(body?.message ?? "Upload failed.");
    } catch {
      setStatus("error");
      setMessage("Something went wrong.");
    }
  }

  return (
    <section className="p-5 border border-border rounded-lg bg-white/40">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-2">
        Brand book — PDF upload
      </h2>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        Upload a brand book PDF (any size, any format). The text gets extracted and added to the Brand book notes field above, and the PDF itself lands in Assets linked to this kit. Claude reads the notes when drafting in this voice.
      </p>
      <form onSubmit={handleUpload} className="space-y-3">
        <input
          id="brand-book-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        {file && (
          <p className="text-xs text-muted">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="append"
              checked={mode === "append"}
              onChange={() => setMode("append")}
            />
            Append to existing notes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="replace"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
            Replace notes
          </label>
        </div>
        <button
          type="submit"
          disabled={status === "uploading" || !file}
          className="px-5 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {status === "uploading" ? "Extracting…" : "Upload + extract"}
        </button>
        {message && (
          <p
            className={`text-sm ${status === "error" ? "text-red-600" : "text-muted"}`}
          >
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
