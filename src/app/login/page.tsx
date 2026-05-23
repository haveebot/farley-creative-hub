import { getBrand } from "@/lib/db/brand";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const brand = await getBrand().catch(() => null);
  const label = brand?.hub_label ?? "Farley Creative Hub";

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-widest text-muted mb-3">
            {label}
          </p>
          <h1 className="text-3xl font-serif">Sign in</h1>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted pt-4 mt-4">
          New here? <a href="/signup" className="underline">Create account</a>
        </p>
      </div>
    </main>
  );
}
