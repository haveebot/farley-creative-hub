import { listListings } from "@/lib/db/listings";
import { LISTING_STATUS_LABELS } from "@/lib/listings-shared";
import TopNav from "../TopNav";
import SyncFromEtsyButton from "./SyncFromEtsyButton";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const listings = await listListings();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Etsy
            </p>
            <h1 className="text-2xl font-serif mb-2">Listings</h1>
            <p className="text-sm text-muted leading-relaxed">
              Draft listings with Claude in your studio voice, attach images from your asset library, then push to Etsy as drafts you can review + publish from your seller dashboard. Already on Etsy? Use Sync to pull existing listings in.
            </p>
          </header>

          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <p className="text-sm text-muted">
              {listings.length === 0
                ? "No listings yet."
                : `${listings.length} listing${listings.length === 1 ? "" : "s"}.`}
            </p>
            <div className="flex items-center gap-4">
              <SyncFromEtsyButton />
              <a
                href="/listings/new"
                className="text-sm font-medium underline hover:text-accent transition"
              >
                + Prep new listing
              </a>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="border border-border rounded p-8 text-center">
              <p className="text-sm text-muted mb-4">
                Each listing starts with a few sentences about what you&apos;re selling — design type, use case, customization options, file format. Claude drafts the full Etsy listing package in your studio voice; you set price, pick a category, attach images, and push to Etsy as a draft for final review.
              </p>
              <a
                href="/listings/new"
                className="inline-block bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition"
              >
                Prep your first listing →
              </a>
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {listings.map((l) => (
                <li key={l.id}>
                  <a
                    href={`/listings/${l.id}`}
                    className="flex items-center justify-between py-4 px-2 -mx-2 rounded hover:bg-surface-strong transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{l.working_name}</p>
                      {l.title && (
                        <p className="text-sm text-muted truncate mt-0.5">
                          Title: {l.title}
                        </p>
                      )}
                      <p className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
                        {l.price_cents != null && (
                          <span>${(l.price_cents / 100).toFixed(2)}</span>
                        )}
                        {l.price_cents != null && <span>·</span>}
                        <span>qty {l.quantity}</span>
                        {l.etsy_state && (
                          <>
                            <span>·</span>
                            <span className="text-accent">
                              {etsyStateLabel(l.etsy_state)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-xs uppercase tracking-wider ml-3 shrink-0 ${
                        l.status === "posted"
                          ? "text-accent"
                          : l.status === "approved"
                            ? "text-foreground"
                            : "text-muted"
                      }`}
                    >
                      {LISTING_STATUS_LABELS[l.status]}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function etsyStateLabel(state: string): string {
  switch (state) {
    case "active":
      return "Live on Etsy";
    case "draft":
      return "Etsy draft";
    case "inactive":
      return "Etsy inactive";
    case "expired":
      return "Etsy expired";
    case "sold_out":
      return "Sold out";
    default:
      return state;
  }
}
