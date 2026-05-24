import type { GmailExchangeMessage } from "@/lib/gmail/read";

/**
 * Recent Gmail exchange with the prospect's primary contact.
 *
 * Server-rendered — no client interactivity needed. Each message
 * deep-links to the corresponding Gmail thread so the operator can
 * open and read the full body in Gmail itself.
 */
export default function GmailExchange({
  contactEmail,
  contactName,
  messages,
  error,
}: {
  contactEmail: string;
  contactName: string;
  messages: GmailExchangeMessage[];
  error: string | null;
}) {
  const gmailSearchUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(
    `from:${contactEmail} OR to:${contactEmail}`,
  )}`;

  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-lg font-serif">Recent emails with {contactName}</h2>
        <a
          href={gmailSearchUrl}
          target="_blank"
          rel="noopener"
          className="text-xs underline text-muted hover:text-foreground"
        >
          open in Gmail →
        </a>
      </div>
      <p className="text-xs text-muted mb-4">
        From Collie&apos;s Gmail. Read this before sending any drafted follow-up — if {contactName.split(" ")[0]} already replied, you&apos;ll see it here.
      </p>

      {error ? (
        <p className="text-sm text-red-600">
          Couldn&apos;t load Gmail exchange: {error}
        </p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted italic">
          No prior emails with this contact.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {messages.map((m) => {
            const threadUrl = `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`;
            return (
              <li key={m.id} className="py-2.5 text-sm">
                <a
                  href={threadUrl}
                  target="_blank"
                  rel="noopener"
                  className="block hover:opacity-90 transition"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span
                          className={`text-xs uppercase tracking-wider mr-2 ${
                            m.direction === "in" ? "text-accent" : "text-muted"
                          }`}
                        >
                          {m.direction === "in" ? "← in" : "out →"}
                        </span>
                        <span className="font-medium">{m.subject}</span>
                      </p>
                      {m.snippet && (
                        <p className="text-xs text-muted truncate mt-0.5">
                          {m.snippet}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted shrink-0">
                      {formatExchangeDate(m.date)}
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatExchangeDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}
