import TopNav from "../../TopNav";
import NewProspectForm from "./NewProspectForm";

export const dynamic = "force-dynamic";

export default function NewProspectPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Pipeline
            </p>
            <h1 className="text-2xl font-serif mb-2">New prospect</h1>
            <p className="text-sm text-muted leading-relaxed">
              Just business name to start — fill in the rest as you learn it. You'll add contacts + activity on the detail page after creating.
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/pipeline" className="underline">← Pipeline</a>
            </p>
          </header>
          <NewProspectForm />
        </div>
      </main>
    </>
  );
}
