"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TokenSummary = {
  id: number;
  name: string;
  token_prefix: string;
  last_used_at: string | Date | null;
  created_at: string | Date;
  revoked_at: string | Date | null;
};

type Status = "idle" | "creating" | "error";

export default function AgentAccessPanel({
  initialTokens,
}: {
  initialTokens: TokenSummary[];
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{
    name: string;
    plaintext: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!newName.trim()) return;

    setStatus("creating");
    try {
      const res = await fetch("/api/agent-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setJustCreated({ name: newName.trim(), plaintext: data.token });
        setTokens([data.record, ...tokens]);
        setNewName("");
        setStatus("idle");
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.error ?? "Couldn't create token.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Try again.");
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm("Revoke this token? Any agent using it stops working immediately.")) {
      return;
    }
    try {
      const res = await fetch(`/api/agent-tokens/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTokens(tokens.map((t) => (t.id === id ? { ...t, revoked_at: new Date() } : t)));
        router.refresh();
      }
    } catch {
      // ignored — UI just won't update
    }
  }

  async function copyToken() {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-10">
      {/* New token result — only visible right after creation */}
      {justCreated && (
        <section className="p-5 border border-accent rounded-lg bg-accent/5">
          <h2 className="text-sm font-medium uppercase tracking-wider mb-2">
            New token: {justCreated.name}
          </h2>
          <p className="text-xs text-muted mb-3">
            Copy it now — it won't be shown again. If you lose it, revoke and create a new one.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-border rounded font-mono text-sm break-all">
              {justCreated.plaintext}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="px-4 py-2 bg-accent text-white rounded-md font-medium hover:opacity-90 transition text-sm"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted mt-3">
            Use as a header: <code className="font-mono">Authorization: Bearer {justCreated.plaintext.slice(0, 12)}…</code>
          </p>
          <button
            type="button"
            onClick={() => setJustCreated(null)}
            className="mt-3 text-xs text-muted underline"
          >
            I've copied it — dismiss
          </button>
        </section>
      )}

      {/* Create new token form */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
          Create token
        </h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <label className="flex-1">
            <span className="block text-sm mb-2">Token name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Collie's Claude (MacBook), Winston's Claude Code, Etsy sync script"
              className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
            />
          </label>
          <button
            type="submit"
            disabled={status === "creating" || !newName.trim()}
            className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {status === "creating" ? "Creating…" : "Create"}
          </button>
        </form>
        {errorMessage && (
          <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
        )}
      </section>

      {/* Existing tokens */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
          Existing tokens
        </h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted">No tokens yet. Create one above.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <TokenRow key={t.id} token={t} onRevoke={handleRevoke} />
            ))}
          </ul>
        )}
      </section>

      {/* How to use — REST */}
      <section className="pt-4 border-t border-border">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
          Use as REST API
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-2">
          Pass the token as a Bearer header on any Hub endpoint:
        </p>
        <pre className="text-xs bg-surface border border-border rounded p-3 overflow-x-auto">
{`curl https://hub.farleycreative.com/api/brand-kits/studio \\
  -H "Authorization: Bearer fch_…your_token…"`}
        </pre>
        <p className="text-xs text-muted mt-3">
          Endpoints: <code>/api/hub-preferences</code> · <code>/api/brand-kits/studio</code> · <code>/api/assets</code> (more coming each phase)
        </p>
      </section>

      {/* How to use — MCP */}
      <section className="pt-4 border-t border-border">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
          Use as Claude tool (MCP)
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-3">
          The Hub speaks the Model Context Protocol — once added, the Hub's tools appear inside Claude (read brand kits, update voice notes, list assets, manage the pipeline, etc.) without curl.
        </p>

        <p className="text-sm text-muted mb-2">Server URL:</p>
        <pre className="text-xs bg-surface border border-border rounded p-3 overflow-x-auto">
{`https://hub.farleycreative.com/api/mcp`}
        </pre>

        <p className="text-sm text-muted mt-4 mb-2">Auth header (when prompted):</p>
        <pre className="text-xs bg-surface border border-border rounded p-3 overflow-x-auto">
{`Authorization: Bearer fch_…your_token…`}
        </pre>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">If you use <strong>Claude Code</strong> (the CLI):</p>
            <pre className="text-xs bg-surface border border-border rounded p-3 overflow-x-auto">
{`claude mcp add farley-creative-hub \\
  https://hub.farleycreative.com/api/mcp \\
  --scope user \\
  --transport http \\
  --header "Authorization: Bearer fch_…your_token…"`}
            </pre>
            <p className="text-xs text-muted mt-1">
              Verify with <code>claude mcp list</code>. Tools appear prefixed as
              {" "}<code>mcp__farley-creative-hub__*</code>.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">If you use the <strong>Claude desktop app</strong> (Mac / Windows):</p>
            <p className="text-xs text-muted">
              <strong>Settings → Connectors → Add custom connector</strong>, paste the URL above and add the Authorization header.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted mt-5">
          Sanity check: open the URL in a browser — you'll see server info and the list of available tools (no auth required for that endpoint).
        </p>
      </section>
    </div>
  );
}

function TokenRow({
  token,
  onRevoke,
}: {
  token: TokenSummary;
  onRevoke: (id: number) => void;
}) {
  const isRevoked = !!token.revoked_at;
  const lastUsed = token.last_used_at
    ? new Date(token.last_used_at).toLocaleString()
    : "never";

  return (
    <li className={`p-4 border border-border rounded-lg ${isRevoked ? "opacity-50" : "bg-surface"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium truncate">{token.name}</div>
          <div className="text-xs text-muted mt-1 font-mono">{token.token_prefix}…</div>
          <div className="text-xs text-muted mt-1">
            Last used: {lastUsed}
            {isRevoked && (
              <span className="ml-3 text-red-600">
                Revoked {new Date(token.revoked_at!).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {!isRevoked && (
          <button
            type="button"
            onClick={() => onRevoke(token.id)}
            className="text-sm text-red-600 hover:underline"
          >
            Revoke
          </button>
        )}
      </div>
    </li>
  );
}
