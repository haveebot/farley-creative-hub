import { isDemoMode } from "@/lib/demo-mode";

/**
 * Banner shown across every page when DEMO_MODE=true. Reminds the
 * visitor this is a live working demo, sets expectations that
 * writes don't persist, and explains the sample-content posture.
 *
 * Renders as a server component — no client interactivity. When
 * DEMO_MODE is off (normal FC Hub), this component returns null.
 */
export default function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      style={{
        background: "var(--color-accent)",
        color: "#fafaf7",
      }}
      className="text-xs sm:text-sm px-4 py-2 flex items-center justify-center gap-3 flex-wrap"
    >
      <span className="font-medium uppercase tracking-wider text-[10px] sm:text-xs opacity-90">
        Demo Hub
      </span>
      <span className="opacity-95">
        This is a live working preview of the Farley Creative operating
        system. Everything you see is realistic sample content. Changes
        don&apos;t persist.
      </span>
    </div>
  );
}
