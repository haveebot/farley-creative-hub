/**
 * /voice/new — create a new voice profile.
 *
 * Three paths:
 *   1. From samples — paste real writing, Claude extracts a draft profile
 *   2. From existing — pull from existing Hub drafts + Etsy listings + pipeline
 *   3. Blank — set up manually (template optional)
 */

import TopNav from "../../TopNav";
import NewVoiceForm from "./NewVoiceForm";

export const dynamic = "force-dynamic";

export default function NewVoicePage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Voice / new
            </p>
            <h1 className="text-2xl font-serif mb-2">Create a voice profile</h1>
            <p className="text-sm text-muted leading-relaxed">
              The fastest path: paste a few real writing samples — past emails,
              Etsy listings, social posts — and let Claude extract the
              patterns. Edit before saving.
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/voice" className="underline">← Voice profiles</a>
            </p>
          </header>
          <NewVoiceForm />
        </div>
      </main>
    </>
  );
}
