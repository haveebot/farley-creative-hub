import { getCurrentOperatorEmail } from "@/lib/auth/session";

export default async function Home() {
  // Middleware guarantees a valid session, but read it here for display.
  const email = await getCurrentOperatorEmail();

  const greeting = getGreeting();

  return (
    <main className="min-h-screen p-8 md:p-12">
      <header className="max-w-5xl mx-auto flex items-center justify-between mb-12">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-1">
            Farley Creative Hub
          </p>
          <h1 className="text-2xl font-serif">{greeting}.</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="text-sm text-muted hover:text-foreground transition"
          >
            Sign out
          </button>
        </form>
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
            <li>Connect Etsy shop (pending app approval)</li>
            <li>Set up brand identity (coming soon)</li>
            <li>Drop a design to draft a listing (coming soon)</li>
          </ul>
        </Card>
      </section>

      <footer className="max-w-5xl mx-auto mt-16 text-xs text-muted">
        Signed in as {email}
      </footer>
    </main>
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Up late";
}
