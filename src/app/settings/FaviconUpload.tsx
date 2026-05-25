"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function FaviconUpload({
  initialUrl,
}: {
  initialUrl: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState<null | "upload" | "remove">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setBusy("upload");
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/hub-preferences/favicon", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.message ?? data.error ?? "Upload failed");
        setBusy(null);
        return;
      }
      setUrl(data.favicon_url);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  }

  async function handleRemove() {
    if (!confirm("Remove custom favicon? The Hub will fall back to the default F mark.")) return;
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch("/api/hub-preferences/favicon", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Remove failed");
        setBusy(null);
        return;
      }
      setUrl(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  }

  return (
    <section>
      <p className="text-sm font-medium mb-1">Favicon</p>
      <p className="text-xs text-muted mb-3">
        Shown in browser tabs + on the iOS home screen. PNG, JPEG, ICO, SVG, or
        WebP. Max 500KB. Square works best (32×32 minimum, 180×180 recommended
        for retina). Replace the default F mark anytime; the Hub falls back to
        the F if no custom favicon is set.
      </p>

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-16 h-16 rounded-lg border border-border bg-surface flex items-center justify-center overflow-hidden">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Current favicon" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-muted text-center">Default<br />(F mark)</span>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/x-icon,image/svg+xml,image/webp,.ico"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy !== null}
              className="text-sm bg-accent text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {busy === "upload" ? "Uploading…" : url ? "Replace favicon" : "Upload favicon"}
            </button>
            {url && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy !== null}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {busy === "remove" ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs text-muted">
            Browsers cache favicons aggressively — hard-reload (Cmd+Shift+R) to see
            changes immediately.
          </p>
        </div>
      </div>
    </section>
  );
}
