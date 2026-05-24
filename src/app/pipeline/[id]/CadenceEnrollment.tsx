"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  Cadence,
  ProspectEnrollment,
  ProspectSend,
} from "@/lib/cadences-shared";

export default function CadenceEnrollment({
  prospectId,
  activeEnrollment,
  pastEnrollments,
  recentSends,
  cadences,
}: {
  prospectId: number;
  activeEnrollment: ProspectEnrollment | null;
  pastEnrollments: ProspectEnrollment[];
  recentSends: ProspectSend[];
  cadences: Cadence[];
}) {
  const cadencesById = new Map(cadences.map((c) => [c.id, c]));
  const activeCadence = activeEnrollment
    ? cadencesById.get(activeEnrollment.cadence_id) ?? null
    : null;

  return (
    <section className="p-5 border border-border rounded-lg bg-surface">
      <h2 className="text-lg font-serif mb-3">Cadence</h2>
      {activeEnrollment ? (
        <ActiveEnrollmentView
          prospectId={prospectId}
          enrollment={activeEnrollment}
          cadence={activeCadence}
          recentSends={recentSends}
        />
      ) : (
        <EnrollForm prospectId={prospectId} cadences={cadences} />
      )}

      {pastEnrollments.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs uppercase tracking-widest text-muted mb-2">
            Past enrollments
          </p>
          <ul className="text-sm space-y-1">
            {pastEnrollments.map((e) => {
              const cadence = cadencesById.get(e.cadence_id);
              return (
                <li key={e.id} className="flex items-center justify-between text-muted">
                  <span>
                    {cadence?.name ?? `Cadence #${e.cadence_id}`} ·{" "}
                    <span className="italic">{e.status}</span>
                  </span>
                  <span className="text-xs">
                    {new Date(e.enrolled_at).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ============ Enroll form (no active enrollment) ============

function EnrollForm({
  prospectId,
  cadences,
}: {
  prospectId: number;
  cadences: Cadence[];
}) {
  const router = useRouter();
  const [cadenceId, setCadenceId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!cadenceId) {
      setError("Pick a cadence.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/prospects/${prospectId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cadence_id: cadenceId }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message ?? data.error ?? "Failed to enroll.");
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  if (cadences.length === 0) {
    return (
      <p className="text-sm text-muted">
        No active cadences yet.{" "}
        <a href="/cadences/new" className="underline">
          Create one
        </a>{" "}
        to enroll this prospect.
      </p>
    );
  }

  return (
    <form onSubmit={handleEnroll} className="flex items-center gap-3">
      <select
        value={cadenceId}
        onChange={(e) => setCadenceId(e.target.value ? Number(e.target.value) : "")}
        className="border border-border rounded px-3 py-2 bg-surface text-foreground text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">— Pick a cadence —</option>
        {cadences.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={submitting || !cadenceId}
        className="bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {submitting ? "Enrolling…" : "Enroll"}
      </button>
      {error && (
        <p className="text-sm text-red-600 ml-2 flex-shrink-0">{error}</p>
      )}
    </form>
  );
}

// ============ Active enrollment view ============

function ActiveEnrollmentView({
  prospectId: _prospectId,
  enrollment,
  cadence,
  recentSends,
}: {
  prospectId: number;
  enrollment: ProspectEnrollment;
  cadence: Cadence | null;
  recentSends: ProspectSend[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function transition(action: "pause" | "resume" | "cancel", reason?: string) {
    setBusy(action);
    const res = await fetch(`/api/enrollments/${enrollment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message ?? data.error ?? "Failed.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  function handleCancel() {
    const reason = prompt("Reason for cancelling? (optional)") ?? undefined;
    if (reason === null) return;
    transition("cancel", reason || undefined);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm">
            Enrolled in{" "}
            {cadence ? (
              <a href={`/cadences/${cadence.id}`} className="font-medium underline">
                {cadence.name}
              </a>
            ) : (
              <span className="font-medium">Cadence #{enrollment.cadence_id}</span>
            )}
          </p>
          <p className="text-xs text-muted mt-1">
            Step {enrollment.current_step}
            {enrollment.next_send_at && enrollment.status === "active" && (
              <> · next send: {new Date(enrollment.next_send_at).toLocaleString()}</>
            )}
            {enrollment.status === "paused" && " · paused"}
          </p>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          {enrollment.status === "active" && (
            <button
              onClick={() => transition("pause")}
              disabled={busy !== null}
              className="text-muted hover:text-foreground hover:underline disabled:opacity-50"
            >
              {busy === "pause" ? "Pausing…" : "Pause"}
            </button>
          )}
          {enrollment.status === "paused" && (
            <button
              onClick={() => transition("resume")}
              disabled={busy !== null}
              className="text-muted hover:text-foreground hover:underline disabled:opacity-50"
            >
              {busy === "resume" ? "Resuming…" : "Resume"}
            </button>
          )}
          <button
            onClick={handleCancel}
            disabled={busy !== null}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      </div>

      {recentSends.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs uppercase tracking-widest text-muted mb-2">Sends</p>
          <ul className="text-sm space-y-1">
            {recentSends.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span className="truncate">
                  Step {s.step_number}: {s.subject}
                </span>
                <span
                  className={`text-xs uppercase tracking-wider ml-2 flex-shrink-0 ${
                    s.status === "sent"
                      ? "text-accent"
                      : s.status === "failed" || s.status === "bounced"
                        ? "text-red-600"
                        : "text-muted"
                  }`}
                >
                  {s.status}
                  {s.sent_at && " · " + new Date(s.sent_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
