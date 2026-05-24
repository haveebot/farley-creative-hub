import { getActiveConnection } from "@/lib/db/etsy";
import TopNav from "../../TopNav";

export const dynamic = "force-dynamic";

export default async function EtsySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const conn = await getActiveConnection();
  const hasCredentials = !!process.env.ETSY_CLIENT_ID;

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Settings
            </p>
            <h1 className="text-2xl font-serif mb-2">Etsy</h1>
            <p className="text-sm text-muted leading-relaxed">
              Connect your Etsy shop so the Hub can pull listings, sales, and customer messages — and (soon) publish listing drafts directly. Connection uses Etsy's OAuth; tokens are stored encrypted and refreshed automatically.
            </p>
          </header>

          <nav className="flex gap-4 mb-8 pb-4 border-b border-border text-sm">
            <a href="/settings" className="text-muted hover:text-foreground transition">
              Hub look &amp; feel
            </a>
            <a href="/settings/agent-access" className="text-muted hover:text-foreground transition">
              Agent access
            </a>
            <a href="/settings/etsy" className="font-medium underline">
              Etsy
            </a>
          </nav>

          {params.connected && (
            <div className="mb-6 p-4 border border-accent rounded-lg bg-accent/5 text-sm">
              ✓ Etsy connected successfully.
            </div>
          )}
          {params.error && (
            <div className="mb-6 p-4 border border-red-300 rounded-lg bg-red-50 text-sm text-red-700">
              Connection failed: {decodeURIComponent(params.error)}
            </div>
          )}

          {!hasCredentials ? (
            <section className="p-5 border border-border rounded-lg bg-surface">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-2">
                Not configured
              </h2>
              <p className="text-sm mb-3">
                ETSY_CLIENT_ID and ETSY_CLIENT_SECRET aren't set on the deployment yet. The operator needs to add them in Vercel env vars once the Etsy Developer app is approved.
              </p>
              <p className="text-xs text-muted">
                Until then, the Connect button below won't work — the connection scaffolding is ready and will activate the moment those env vars exist.
              </p>
            </section>
          ) : conn ? (
            <section className="p-5 border border-border rounded-lg bg-surface space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                Connected
              </h2>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted">Shop:</span>{" "}
                  <span className="font-medium">
                    {conn.shop_name ?? "(name not yet fetched)"}
                  </span>
                  {conn.shop_id && (
                    <span className="text-xs text-muted ml-2">#{conn.shop_id}</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  Connected {new Date(conn.connected_at).toLocaleString()} by {conn.connected_by}
                </p>
                <p className="text-xs text-muted">
                  Token expires {new Date(conn.expires_at).toLocaleString()} (auto-refreshed when API is called)
                </p>
                <p className="text-xs text-muted">
                  Scopes: {conn.scopes.join(", ") || "(stored from token only)"}
                </p>
              </div>
              <div className="pt-3 border-t border-border flex items-center gap-3 text-sm">
                <a
                  href="/api/etsy/shop"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  Test connection →
                </a>
                <form action="/api/etsy/disconnect" method="post" className="inline">
                  <button
                    type="submit"
                    className="text-red-600 hover:underline"
                  >
                    Disconnect
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <section className="p-5 border border-border rounded-lg bg-surface">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-2">
                Not connected
              </h2>
              <p className="text-sm mb-4">
                Click below to authorize the Hub against your Etsy account.
                Etsy will ask you which shop to connect and which permissions to grant.
              </p>
              <a
                href="/api/etsy/connect"
                className="inline-block px-5 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition"
              >
                Connect Etsy →
              </a>
              <p className="text-xs text-muted mt-3">
                Scopes requested: shops_r · listings_r · listings_w · transactions_r · email_r
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
