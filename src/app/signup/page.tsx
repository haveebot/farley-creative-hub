import { redirect } from "next/navigation";
import { countUsers } from "@/lib/db/users";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // If a user already exists, setup is locked. Redirect to /login.
  const userCount = await countUsers();
  if (userCount > 0) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-widest text-muted mb-3">
            Farley Creative Hub
          </p>
          <h1 className="text-3xl font-serif mb-3">Create your account</h1>
          <p className="text-sm text-muted">
            One-time setup. Your email and password will sign you into the Hub from here on.
          </p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
