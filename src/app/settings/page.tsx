import { getHubPreferences } from "@/lib/db/hub-preferences";
import TopNav from "../TopNav";
import HubSettingsForm from "./HubSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getHubPreferences();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Settings
            </p>
            <h1 className="text-2xl font-serif mb-2">Hub look &amp; feel</h1>
            <p className="text-sm text-muted leading-relaxed">
              How this dashboard presents itself to you. Just operator chrome — not customer-facing. Your studio's actual brand lives under <a href="/brand" className="underline">Brand</a>.
            </p>
          </header>

          <nav className="flex gap-4 mb-8 pb-4 border-b border-border text-sm">
            <a href="/settings" className="font-medium underline">Hub look &amp; feel</a>
            <a href="/settings/agent-access" className="text-muted hover:text-foreground transition">Agent access</a>
            <a href="/settings/etsy" className="text-muted hover:text-foreground transition">Etsy</a>
          </nav>

          <HubSettingsForm initial={prefs} />
        </div>
      </main>
    </>
  );
}
