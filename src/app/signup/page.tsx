import { getBrand } from "@/lib/db/brand";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const brand = await getBrand().catch(() => null);
  const label = brand?.hub_label ?? "Farley Creative Hub";

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-widest text-muted mb-3">
            {label}
          </p>
          <h1 className="text-3xl font-serif mb-3">Create account</h1>
          <p className="text-sm text-muted">
            You need a signup key to create an account. Get it from whoever invited you.
          </p>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}
