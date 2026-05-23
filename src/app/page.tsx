import { getCurrentOperatorEmail } from "@/lib/auth/session";
import { getStudioKit } from "@/lib/db/brand-kits";
import Greeting from "./Greeting";
import TopNav from "./TopNav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [email, studio] = await Promise.all([
    getCurrentOperatorEmail(),
    getStudioKit(),
  ]);

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
          <Card title="Awaiting you" subtitle="0 items">
            Nothing waiting. Listing drafts and customer messages will land here.
          </Card>
          <Card title="Today" subtitle="—">
            Sales, new orders, and reviews show up here once Etsy is connected.
          </Card>
          <Card title="Quick actions" subtitle="">
            <ul className="text-sm space-y-2 text-muted">
              <li>
                <a href="/brand" className="hover:text-foreground transition">
                  → Edit studio brand kit
                </a>
              </li>
              <li>
                <a href="/settings" className="hover:text-foreground transition">
                  → Hub settings
                </a>
              </li>
              <li>Connect Etsy shop (pending app approval)</li>
              <li>Drop a design to draft a listing (coming soon)</li>
            </ul>
          </Card>
        </section>

        <footer className="max-w-5xl mx-auto mt-16 text-xs text-muted flex items-center justify-between">
          <span>{studio.name}</span>
          <span>Signed in as {email}</span>
        </footer>
      </main>
    </>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 border border-border rounded-lg bg-white/40">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider">{title}</h2>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
