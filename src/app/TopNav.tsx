import { getHubPreferences } from "@/lib/db/hub-preferences";

/**
 * Top nav shared across authenticated pages.
 * Server component — reads Hub preferences for the label.
 */
export default async function TopNav() {
  const prefs = await getHubPreferences().catch(() => null);
  const label = prefs?.hub_label ?? "Farley Creative Hub";

  return (
    <nav className="border-b border-border">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-8 py-4">
        <a href="/" className="text-sm font-medium uppercase tracking-widest">
          {label}
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/" className="text-muted hover:text-foreground transition">
            Hub
          </a>
          <a href="/brand" className="text-muted hover:text-foreground transition">
            Brand
          </a>
          <a href="/voice" className="text-muted hover:text-foreground transition">
            Voice
          </a>
          <a href="/assets" className="text-muted hover:text-foreground transition">
            Assets
          </a>
          <a href="/drafts" className="text-muted hover:text-foreground transition">
            Drafts
          </a>
          <a href="/listings" className="text-muted hover:text-foreground transition">
            Etsy
          </a>
          <a href="/pipeline" className="text-muted hover:text-foreground transition">
            Pipeline
          </a>
          <a href="/clients" className="text-muted hover:text-foreground transition">
            Clients
          </a>
          <a href="/settings" className="text-muted hover:text-foreground transition">
            Settings
          </a>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-muted hover:text-foreground transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
