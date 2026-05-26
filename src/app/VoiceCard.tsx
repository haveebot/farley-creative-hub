/**
 * Voice readiness card for Hub home. Surfaces the default voice profile
 * (or a setup nudge if none exists) so it's visible every Hub visit.
 */

import Link from "next/link";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";

export default async function VoiceCard() {
  const voice = await getDefaultVoiceProfile();

  if (!voice) {
    return (
      <section className="border-2 border-accent/30 rounded-lg bg-accent/5 p-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs uppercase tracking-widest text-accent">
            Voice — not configured
          </p>
          <Link
            href="/voice"
            className="text-xs underline text-accent hover:text-foreground transition"
          >
            Set up →
          </Link>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">
          Voice is the #1 lever on draft quality. Seed one in 5 seconds from
          your studio brand kit, or analyze existing Etsy listings + drafts to
          generate a profile.
        </p>
      </section>
    );
  }

  const samplesLen = voice.writing_samples?.length ?? 0;
  const sampleStrength =
    samplesLen >= 2000 ? "strong" : samplesLen >= 500 ? "decent" : "thin";
  const sampleColor =
    sampleStrength === "strong"
      ? "text-accent"
      : sampleStrength === "decent"
        ? "text-foreground/70"
        : "text-warm-black/50";

  return (
    <section className="border border-border rounded-lg bg-surface p-5">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">
            Default voice
          </p>
          <p className="text-sm font-medium">{voice.name}</p>
        </div>
        <Link
          href={`/voice/${voice.id}`}
          className="text-xs underline text-muted hover:text-foreground transition"
        >
          Edit →
        </Link>
      </div>
      {voice.description && (
        <p className="text-xs text-muted italic mb-3">{voice.description}</p>
      )}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat label="Always-say" value={voice.always_say.length} />
        <Stat label="Never-say" value={voice.never_say.length} />
        <Stat
          label="Sample size"
          value={`${samplesLen.toLocaleString()} ch`}
          color={sampleColor}
          hint={sampleStrength}
        />
      </div>
      <p className="text-[10px] text-muted mt-4 pt-3 border-t border-border">
        <Link href="/voice" className="hover:text-foreground transition">
          All voice profiles →
        </Link>
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string | number;
  color?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className={`text-base font-medium tabular-nums ${color ?? ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="text-[10px] text-muted italic mt-0.5">{hint}</p>}
    </div>
  );
}
