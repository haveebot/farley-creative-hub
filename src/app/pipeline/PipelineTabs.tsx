/**
 * Sub-nav for /pipeline pages — Active prospects vs Leads.
 * Server component; takes the current pathname to mark active tab.
 */

export default function PipelineTabs({ active }: { active: "active" | "leads" }) {
  return (
    <nav className="flex gap-4 mb-6 pb-3 border-b border-border text-sm">
      <a
        href="/pipeline"
        className={
          active === "active"
            ? "font-medium underline"
            : "text-muted hover:text-foreground transition"
        }
      >
        Active prospects
      </a>
      <a
        href="/pipeline/leads"
        className={
          active === "leads"
            ? "font-medium underline"
            : "text-muted hover:text-foreground transition"
        }
      >
        Leads
      </a>
    </nav>
  );
}
