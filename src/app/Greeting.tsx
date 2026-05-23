"use client";

import { useEffect, useState } from "react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Up late";
}

/**
 * Time-aware greeting calculated in the browser so it reflects the
 * user's local time, not the server's. Initial render uses a generic
 * default ("Welcome back") to avoid hydration mismatch; the useEffect
 * swaps in the time-based greeting right after mount.
 */
export default function Greeting() {
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return <>{greeting}</>;
}
