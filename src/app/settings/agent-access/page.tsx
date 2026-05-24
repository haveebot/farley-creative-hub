import { listAgentTokens } from "@/lib/db/agent-tokens";
import TopNav from "../../TopNav";
import AgentAccessPanel from "./AgentAccessPanel";

export const dynamic = "force-dynamic";

export default async function AgentAccessPage() {
  const tokens = await listAgentTokens();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Settings
            </p>
            <h1 className="text-2xl font-serif mb-2">Agent access</h1>
            <p className="text-sm text-muted leading-relaxed">
              Generate tokens for Claude (or any agent) to read and update the Hub programmatically. Each token works as a Bearer credential on every Hub API endpoint. Use one token per device or person — that way revoking is precise.
            </p>
          </header>

          <nav className="flex gap-4 mb-8 pb-4 border-b border-border text-sm">
            <a href="/settings" className="text-muted hover:text-foreground transition">Hub look &amp; feel</a>
            <a href="/settings/agent-access" className="font-medium underline">Agent access</a>
            <a href="/settings/workspace" className="text-muted hover:text-foreground transition">Workspace</a>
            <a href="/settings/etsy" className="text-muted hover:text-foreground transition">Etsy</a>
          </nav>

          <AgentAccessPanel initialTokens={tokens} />
        </div>
      </main>
    </>
  );
}
