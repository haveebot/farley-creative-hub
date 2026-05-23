"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-sm uppercase tracking-widest text-muted mb-4">check your inbox</p>
          <h1 className="text-3xl font-serif mb-6">Sign-in link sent</h1>
          <p className="text-muted leading-relaxed">
            If <span className="font-medium text-foreground">{email}</span> is authorized, a sign-in link is on its way. It expires in 15 minutes.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-widest text-muted mb-3">
            Farley Creative Hub
          </p>
          <h1 className="text-3xl font-serif">Sign in</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm text-muted mb-2">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
          {status === "error" && (
            <p className="text-sm text-red-600 text-center">Something went wrong. Try again.</p>
          )}
        </form>
      </div>
    </main>
  );
}
