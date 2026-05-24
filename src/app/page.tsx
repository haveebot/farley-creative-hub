import { getCurrentOperatorEmail } from "@/lib/auth/session";
import { listBrandKits } from "@/lib/db/brand-kits";
import { listAssets } from "@/lib/db/assets";
import { listDrafts } from "@/lib/db/drafts";
import { KIND_LABELS } from "@/lib/drafts-shared";
import Greeting from "./Greeting";
import TopNav from "./TopNav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [email, kits, assets, allDrafts] = await Promise.all([
    getCurrentOperatorEmail(),
    listBrandKits(),
    listAssets(),
    listDrafts(),
  ]);

  const studio = kits.find((k) => k.is_studio_self);
  const clientKitCount = kits.filter((k) => !k.is_studio_self).length;

  const draftStatus = allDrafts.filter((d) => d.status === "draft");
  const recentAssets = assets.slice(0, 3);

  // 24h cutoff for "Today" activity
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayDrafts = allDrafts.filter((d) => new Date(d.created_at) > dayAgo);
  const todayAssets = assets.filter((a) => new Date(a.created_at) > dayAgo);

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <header className="max-w-5xl mx-auto mb-12">
          <h1 className="text-3xl font-serif">
            <Greeting />.
          </h1>
        </header>

        <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Awaiting You */}
          <Card title="Awaiting you" subtitle={`${draftStatus.length} ${draftStatus.length === 1 ? "draft" : "drafts"}`} href="/drafts">
            {draftStatus.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing waiting. New drafts (yours or Claude&apos;s) land here for review.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {draftStatus.slice(0, 4).map((d) => (
                  <li key={d.id} className="truncate">
                    <span className="text-xs text-muted">{KIND_LABELS[d.kind] ?? d.kind} ·</span> {d.title}
                  </li>
                ))}
                {draftStatus.length > 4 && (
                  <li className="text-xs text-muted pt-1">
                    + {draftStatus.length - 4} more →
                  </li>
                )}
              </ul>
            )}
          </Card>

          {/* Today */}
          <Card
            title="Today"
            subtitle={
              todayDrafts.length + todayAssets.length === 0
                ? "—"
                : `${todayDrafts.length + todayAssets.length} new`
            }
          >
            {todayDrafts.length + todayAssets.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing yet today. Create a draft, upload an asset, or refine a brand kit.
              </p>
            ) : (
              <ul className="text-sm space-y-2">
                {todayDrafts.length > 0 && (
                  <li>
                    {todayDrafts.length} {todayDrafts.length === 1 ? "draft" : "drafts"} created
                  </li>
                )}
                {todayAssets.length > 0 && (
                  <li>
                    {todayAssets.length} {todayAssets.length === 1 ? "asset" : "assets"} uploaded
                  </li>
                )}
              </ul>
            )}
          </Card>

          {/* Quick actions */}
          <Card title="Quick actions" subtitle="">
            <ul className="text-sm space-y-2 text-muted">
              <li>
                <a href="/drafts" className="hover:text-foreground transition">
                  → Draft something with Claude
                </a>
              </li>
              <li>
                <a href="/brand" className="hover:text-foreground transition">
                  → Edit brand kits {clientKitCount > 0 && `(studio + ${clientKitCount})`}
                </a>
              </li>
              <li>
                <a href="/assets" className="hover:text-foreground transition">
                  → Upload assets {assets.length > 0 && `(${assets.length})`}
                </a>
              </li>
              <li>
                <a href="/settings/agent-access" className="hover:text-foreground transition">
                  → Manage agent tokens
                </a>
              </li>
            </ul>
          </Card>
        </section>

        {/* Recent assets strip */}
        {recentAssets.length > 0 && (
          <section className="max-w-5xl mx-auto mt-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                Recent assets
              </h2>
              <a href="/assets" className="text-xs underline text-muted hover:text-foreground">
                All →
              </a>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {recentAssets.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-video bg-surface border border-border rounded overflow-hidden hover:border-accent transition"
                >
                  {a.mime_type.startsWith("image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-3xl text-muted">
                      <span>{a.mime_type === "application/pdf" ? "📄" : "📦"}</span>
                      <span className="text-xs mt-2 px-2 truncate w-full text-center">{a.name}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="max-w-5xl mx-auto mt-16 text-xs text-muted flex items-center justify-between">
          <span>{studio?.name ?? "Studio"}</span>
          <span>Signed in as {email}</span>
        </footer>
      </main>
    </>
  );
}

function Card({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="p-6 border border-border rounded-lg bg-surface h-full">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider">{title}</h2>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block hover:opacity-90 transition">
        {inner}
      </a>
    );
  }
  return inner;
}
