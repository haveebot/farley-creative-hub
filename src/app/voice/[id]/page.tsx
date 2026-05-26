import { notFound } from "next/navigation";
import { getVoiceProfile } from "@/lib/db/voice-profiles";
import TopNav from "../../TopNav";
import VoiceEditor from "./VoiceEditor";

export const dynamic = "force-dynamic";

export default async function VoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();
  const profile = await getVoiceProfile(numId);
  if (!profile) notFound();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Voice profile
            </p>
            <h1 className="text-2xl font-serif mb-2">{profile.name}</h1>
            {profile.description && (
              <p className="text-sm text-muted leading-relaxed">
                {profile.description}
              </p>
            )}
            <p className="text-xs text-muted mt-4">
              <a href="/voice" className="underline">← Voice profiles</a>
            </p>
          </header>
          <VoiceEditor initial={profile} />
        </div>
      </main>
    </>
  );
}
