import {
  getConnectionByPurpose,
  PURPOSE_LABELS,
  type ConnectionPurpose,
  type WorkspaceConnection,
} from "@/lib/db/workspace-connections";
import TopNav from "../../TopNav";
import BackfillForm from "./BackfillForm";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [sending, readingLeads] = await Promise.all([
    getConnectionByPurpose("sending"),
    getConnectionByPurpose("reading_leads"),
  ]);
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
              Two Workspace roles. Cadence drafts + sends go through the{" "}
              <strong>Sending identity</strong> mailbox (her studio identity).
              Job-alert lead capture polls the <strong>Lead source</strong>{" "}
              mailbox (typically where alerts already arrive — could be a
              different account). Each can be connected independently; they
              don't have to be the same mailbox.
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/settings" className="underline">← Settings</a>
            </p>
          </header>

          {params.connected && (
            <p className="text-sm text-accent mb-4">
              ✓ Connected{" "}
              {params.connected === "sending"
                ? "as sending identity"
                : params.connected === "reading_leads"
                  ? "as lead source"
                  : ""}
              .
            </p>
          )}
          {params.error && (
            <p className="text-sm text-red-600 mb-4">
              Connect failed: {decodeURIComponent(params.error)}
            </p>
          )}

          {!hasCredentials ? (
            <SetupInstructions />
          ) : (
            <div className="space-y-6">
              <ConnectionSlot
                purpose="sending"
                connection={sending}
                description="Mailbox where cadence emails get drafted (then sent by the human operator from Gmail). Sends will originate from this address; replies route here."
                expectedExample="e.g. collie@farleycreative.com"
              />
              <ConnectionSlot
                purpose="reading_leads"
                connection={readingLeads}
                description="Mailbox where the Hub polls for the 'Hub/Leads' label (every 30 min). Job-board digests and other lead sources are labeled here; Hub parses and imports each one. Often a different mailbox than Sending (e.g., a personal account where alerts already arrive)."
                expectedExample="e.g. collie@palmfamilyventures.com"
              />

              {readingLeads && (
                <>
                  <div className="p-5 border border-border rounded-lg bg-surface">
                    <p className="text-xs uppercase tracking-widest text-muted mb-2">
                      Lead capture setup
                    </p>
                    <p className="text-xs text-muted">
                      For the lead-poll cron to find anything, set up a Gmail
                      filter in <strong>{readingLeads.email}</strong>'s inbox that
                      applies the label <code>Hub/Leads</code> to whichever
                      senders are job-alert sources. The Hub creates the label
                      automatically on first poll if it doesn't already exist.
                    </p>
                    <p className="text-xs text-muted mt-2">
                      Gmail filter setup:{" "}
                      <strong>
                        Gmail → Settings (gear) → See all settings → Filters and
                        Blocked Addresses → Create a new filter
                      </strong>
                      . Match senders like{" "}
                      <code>
                        from:(noreply@indeed.com OR alerts@angellist.com)
                      </code>
                      . Action: <strong>Apply the label: Hub/Leads</strong>.
                    </p>
                  </div>

                  <BackfillForm workspaceEmail={readingLeads.email} />
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function ConnectionSlot({
  purpose,
  connection,
  description,
  expectedExample,
}: {
  purpose: ConnectionPurpose;
  connection: WorkspaceConnection | null;
  description: string;
  expectedExample: string;
}) {
  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-medium uppercase tracking-wider">
          {PURPOSE_LABELS[purpose]}
        </h2>
        {connection ? (
          <form
            action={`/api/workspace/disconnect?purpose=${purpose}`}
            method="post"
          >
            <button
              type="submit"
              className="text-xs text-red-600 hover:underline"
            >
              Disconnect
            </button>
          </form>
        ) : (
          <a
            href={`/api/workspace/connect?purpose=${purpose}`}
            className="text-xs bg-accent text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition"
          >
            Connect →
          </a>
        )}
      </div>
      <p className="text-xs text-muted mb-3">{description}</p>
      {connection ? (
        <div>
          <p className="text-base font-serif">{connection.email}</p>
          <p className="text-xs text-muted mt-1">
            Connected by {connection.connected_by} on{" "}
            {new Date(connection.connected_at).toLocaleDateString()} ·{" "}
            {connection.scopes.length} scopes
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted italic">
          Not connected. {expectedExample}.
        </p>
      )}
    </section>
  );
}

function SetupInstructions() {
  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <p className="text-sm">
        <code>GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
        <code>GOOGLE_OAUTH_CLIENT_SECRET</code> aren't set on this deployment
        yet.
      </p>
      <p className="text-sm text-muted mt-3">Operator setup (one-time):</p>
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
        <li>Redeploy. Then come back here and connect both roles.</li>
      </ol>
    </section>
  );
}
