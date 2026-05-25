"use client";

import { useEffect, useRef, useState } from "react";

type TaxNode = { id: number; name: string; path: string; level: number };

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function TaxonomyPicker({
  value,
  valueLabel,
  onChange,
  disabled,
}: {
  value: number | null;
  valueLabel?: string;
  onChange: (id: number | null, label?: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TaxNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = q.trim()
      ? `/api/etsy/taxonomy?q=${encodeURIComponent(q.trim())}`
      : `/api/etsy/taxonomy`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) {
          setError(data.message ?? data.error ?? "Failed to load taxonomy");
          setResults([]);
        } else {
          setResults(data.nodes ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, q]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${inputClasses} text-left flex items-center justify-between ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className={value ? "" : "text-muted"}>
          {valueLabel ?? (value ? `Taxonomy #${value}` : "Pick an Etsy category…")}
        </span>
        <span className="text-muted text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded shadow-lg max-h-96 overflow-y-auto">
          <div className="p-2 border-b border-border sticky top-0 bg-surface">
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search categories (e.g. drinkware, art print)…"
              className={inputClasses}
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-xs text-red-600 hover:underline mt-2"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="p-1">
            {loading && <p className="p-3 text-sm text-muted">Loading…</p>}
            {error && <p className="p-3 text-sm text-red-600">{error}</p>}
            {!loading && !error && results.length === 0 && (
              <p className="p-3 text-sm text-muted">No matches.</p>
            )}
            {results.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onChange(n.id, n.path);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full text-left px-2 py-2 hover:bg-surface-strong rounded text-sm"
              >
                {n.path}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
