/**
 * /voice — voice profile list + entry to create / generate from samples.
 */

import Link from "next/link";
import { listVoiceProfiles } from "@/lib/db/voice-profiles";
import TopNav from "../TopNav";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const profiles = await listVoiceProfiles();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Studio
            </p>
            <h1 className="text-2xl font-serif mb-2">Voice profiles</h1>
            <p className="text-sm text-muted leading-relaxed max-w-2xl">
              A voice profile is a reusable &ldquo;how to sound&rdquo; — independent
              of any visual brand kit. Drafts use a voice profile to apply your
              tone, vocabulary, and audience awareness. Generate one from real
              writing samples (your past Etsy listings, emails, pipeline notes)
              and Claude will extract the patterns.
            </p>
          </header>

          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <p className="text-sm text-muted">
              {profiles.length === 0
                ? "No voice profiles yet."
                : `${profiles.length} profile${profiles.length === 1 ? "" : "s"}.`}
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/voice/new"
                className="text-sm font-medium underline hover:text-accent transition"
              >
                + New voice profile
              </Link>
            </div>
          </div>

          {profiles.length === 0 ? (
            <div className="border border-border rounded p-8 text-center">
              <p className="text-sm text-muted mb-4 max-w-md mx-auto leading-relaxed">
                Voice is the #1 lever on draft quality. Start with one profile
                — your studio voice — and Claude will pattern-match against
                real writing samples instead of guessing.
              </p>
              <Link
                href="/voice/new"
                className="inline-block bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition"
              >
                Create your first voice profile →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {profiles.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/voice/${p.id}`}
                    className="flex items-center justify-between py-4 px-2 -mx-2 rounded hover:bg-surface-strong transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate flex items-center gap-2">
                        {p.name}
                        {p.is_default && (
                          <span className="text-[10px] uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </p>
                      {p.description && (
                        <p className="text-sm text-muted truncate mt-0.5">
                          {p.description}
                        </p>
                      )}
                      <p className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
                        <span>{p.always_say.length} always-say</span>
                        <span>·</span>
                        <span>{p.never_say.length} never-say</span>
                        {p.writing_samples && (
                          <>
                            <span>·</span>
                            <span>
                              {p.writing_samples.length.toLocaleString()} chars of samples
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <span className="text-xs italic text-muted ml-3 shrink-0">
                      Edit →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
