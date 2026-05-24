export const dynamic = "force-static";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Farley Girls Creative Hub.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen p-8">
      <article className="max-w-2xl mx-auto py-12">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-widest text-muted mb-3">
            Farley Girls Creative Hub
          </p>
          <h1 className="text-3xl font-serif mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted">Last updated: May 24, 2026</p>
        </header>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">About this app</h2>
          <p>
            Farley Girls Creative Hub is a personal operator dashboard for the
            Etsy shop Farley Girls Creative (
            <a
              href="https://farleygirlscreative.etsy.com"
              className="underline"
            >
              farleygirlscreative.etsy.com
            </a>
            ). It is used by the shop owner to draft listing copy, organize
            design assets, and view shop activity. It is not a multi-user
            service and does not provide accounts to anyone outside the shop's
            owner-operator.
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">What data is collected</h2>
          <p>
            When the shop owner uses the Hub, the following data is stored in
            the Hub's own database:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Account information — email address and a hashed password used to
              sign in.
            </li>
            <li>
              Brand information that the owner enters — studio name, voice
              notes, color palette, brand book documents, social handles.
            </li>
            <li>
              Design assets that the owner uploads — image and document files,
              stored in private object storage.
            </li>
            <li>
              Drafts that the owner creates inside the Hub — listing copy,
              social posts, customer reply drafts, and similar.
            </li>
            <li>
              Sales-pipeline notes the owner enters about her own creative
              studio's clients and prospects.
            </li>
            <li>
              When the owner connects an Etsy shop: her own shop's listings,
              transaction history, and incoming customer messages — pulled
              from Etsy's API only for display inside the Hub for the shop
              owner.
            </li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">Where data is stored</h2>
          <p>
            All data is stored in private infrastructure controlled by the shop
            owner: a private PostgreSQL database (Neon) and private object
            storage (Vercel Blob). The Hub is deployed on Vercel. None of this
            data is published, shared with other Hub users, or made publicly
            accessible.
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">Third parties</h2>
          <p>
            The Hub does not sell, lease, or transfer Etsy API access, Etsy
            credentials, or Etsy member data (including listings, transactions,
            or customer messages) to any third party. There are no analytics
            services, advertising networks, or data brokers in the Hub.
          </p>
          <p>
            The Hub uses Anthropic's Claude API to assist the owner with
            drafting copy. Only the content the owner explicitly types into a
            draft (or the brand context the owner has saved) is sent to
            Anthropic's API as a prompt. Etsy listings, transactions, and
            customer messages pulled via the Etsy API are not automatically
            sent to Anthropic or any other service.
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">Etsy data handling</h2>
          <p>
            When the shop owner connects her Etsy shop to the Hub via Etsy's
            OAuth, the Hub stores an Etsy access token and refresh token in its
            private database. These tokens are used only to make Etsy API
            requests on behalf of the shop owner from within the Hub.
          </p>
          <p>
            Etsy data fetched via the API is cached locally per Etsy's caching
            policy and used only for display inside the Hub. The owner can
            disconnect the Etsy integration at any time from the Hub's settings
            page, which deletes the stored tokens.
          </p>
          <p className="text-sm text-muted">
            The term "Etsy" is a trademark of Etsy, Inc. This application uses
            the Etsy API but is not endorsed or certified by Etsy, Inc.
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">Data deletion</h2>
          <p>
            The shop owner can delete any data she has entered (brand kits,
            drafts, assets, pipeline notes, Etsy connections) at any time from
            inside the Hub. To request full account and data deletion, contact
            the address below.
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">Contact</h2>
          <p>
            Questions about this privacy policy or about data stored in the Hub
            can be sent to{" "}
            <a
              href="mailto:collie@farleycreative.com"
              className="underline"
            >
              collie@farleycreative.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-serif">Changes to this policy</h2>
          <p>
            If this policy changes, the "Last updated" date at the top of this
            page will be revised. Material changes will be noted on the Hub's
            home page after the owner signs in.
          </p>
        </section>
      </article>
    </main>
  );
}
