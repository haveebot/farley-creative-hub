"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "error";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        // Hard reload so middleware re-evaluates with new session.
        window.location.href = "/";
        return;
      }

      setStatus("error");
      setErrorMessage("Email or password didn't match. Try again.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-sm text-muted mb-2">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
        />
      </label>
      <label className="block">
        <span className="block text-sm text-muted mb-2">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
        />
      </label>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {status === "submitting" ? "Signing in…" : "Sign in"}
      </button>
      {errorMessage && (
        <p className="text-sm text-red-600 text-center">{errorMessage}</p>
      )}
    </form>
  );
}
