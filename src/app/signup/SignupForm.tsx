"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "error";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirm) {
      setStatus("error");
      setErrorMessage("Passwords don't match.");
      return;
    }
    if (password.length < 10) {
      setStatus("error");
      setErrorMessage("Password needs to be at least 10 characters.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, key }),
      });

      if (res.ok) {
        window.location.href = "/";
        return;
      }

      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(
        body?.message ?? "Couldn't create the account. Try again.",
      );
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
          autoComplete="new-password"
          minLength={10}
          className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
        />
        <span className="block text-xs text-muted mt-1">At least 10 characters.</span>
      </label>
      <label className="block">
        <span className="block text-sm text-muted mb-2">Confirm password</span>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={10}
          className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition"
        />
      </label>
      <label className="block">
        <span className="block text-sm text-muted mb-2">Signup key</span>
        <input
          type="text"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          className="w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition font-mono text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {status === "submitting" ? "Creating…" : "Create account & sign in"}
      </button>
      {errorMessage && (
        <p className="text-sm text-red-600 text-center">{errorMessage}</p>
      )}
      <p className="text-center text-sm text-muted pt-2">
        Already have an account? <a href="/login" className="underline">Sign in</a>
      </p>
    </form>
  );
}
