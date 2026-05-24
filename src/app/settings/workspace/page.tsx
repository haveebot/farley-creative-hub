import { getActiveConnection } from "@/lib/db/workspace-connections";
import TopNav from "../../TopNav";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const connection = await getActiveConnection();
  const hasCredentials = !!process.env.GOOGLE_OAUTH_CLIENT_ID;

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Settings
            </p>
            <h1 className="text-2xl font-serif mb-2">Google Workspace</h1>
            <p className="text-sm text-muted leading-relaxed">
              Connect a Google Workspace account so the Hub can draft cadence emails into its Gmail Drafts folder. The Hub never auto-sends — every email gets human review + send from Gmail. Replies thread back to the Inbox natively. Without a connection, cadence drafts queue until Workspace is connected.
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/settings" className="underline">← Settings</a>
            </p>
          </header>

          {params.connected && (
            <p className="text-sm text-accent mb-4">✓ Workspace connected.</p>
          )}
          {params.error && (
            <p className="text-sm text-red-600 mb-4">
              Connect failed: {decodeURIComponent(params.error)}
            </p>
          )}

          {!hasCredentials ? (
            <section className="p-5 border border-border rounded-lg bg-surface">
              <p className="text-sm">
                <code>GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
                <code>GOOGLE_OAUTH_CLIENT_SECRET</code> aren't set on this deployment yet.
              </p>
              <p className="text-sm text-muted mt-3">
                Operator setup (one-time):
              </p>
              <ol className="list-decimal pl-6 mt-2 text-sm text-muted space-y-1">
                <li>
                  Create an OAuth client in{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    className="underline"
                    target="_blank"
                    rel="noopener"
                  >
                    Google Cloud Console
                  </a>{" "}
                  → OAuth 2.0 Client IDs → Web application
                </li>
                <li>
                  Authorized redirect URI:{" "}
                  <code className="text-foreground">
                    https://hub.farleycreative.com/api/workspace/callback
                  </code>
                </li>
                <li>
                  Drop the Client ID + Secret into Vercel as{" "}
                  <code>GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
                  <code>GOOGLE_OAUTH_CLIENT_SECRET</code> (mark Sensitive)
                </li>
                <li>Redeploy. Then come back here and connect.</li>
              </ol>
            </section>
          ) : connection ? (
            <section className="p-5 border border-border rounded-lg bg-surface">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Connected as</p>
                  <p className="text-base font-serif mt-1">{connection.email}</p>
                  <p className="text-xs text-muted mt-2">
                    Connected by {connection.connected_by} on{" "}
                    {new Date(connection.connected_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Scopes: {connection.scopes.length} granted
                  </p>
                </div>
                <form action="/api/workspace/disconnect" method="post">
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Disconnect
                  </button>
                </form>
              </div>
              <p className="text-xs text-muted mt-4 pt-3 border-t border-border">
                Cadence emails now draft into{" "}
                <strong>{connection.email}</strong>'s Gmail Drafts folder.
                Every email is reviewed + sent by the human operator — never auto-sent.
              </p>
            </section>
          ) : (
            <section className="p-5 border border-border rounded-lg bg-surface">
              <p className="text-sm mb-3">No Workspace account connected.</p>
              <p className="text-sm text-muted mb-4">
                Click below to authorize the Hub against a Google Workspace account.
                Google will ask you to sign in and grant Gmail send/read permissions.
              </p>
              <a
                href="/api/workspace/connect"
                className="inline-block bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition"
              >
                Connect Workspace →
              </a>
              <p className="text-xs text-muted mt-3">
                Sign in as the account you want sends to come from (e.g. {" "}
                <code>collie@farleycreative.com</code>).
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
