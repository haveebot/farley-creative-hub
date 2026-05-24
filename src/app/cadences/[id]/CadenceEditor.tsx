"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BrandKit } from "@/lib/db/brand-kits";
import type { Prospect } from "@/lib/pipeline-shared";
import {
  type CadenceStep,
  type CadenceWithSteps,
  type ProspectEnrollment,
  formatStepDelay,
} from "@/lib/cadences-shared";

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

const numberInputClasses =
  "w-20 border border-border rounded px-2 py-1 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function CadenceEditor({
  initialCadence,
  brandKits,
  enrollments,
  prospectsById,
}: {
  initialCadence: CadenceWithSteps;
  brandKits: BrandKit[];
  enrollments: ProspectEnrollment[];
  prospectsById: Record<number, Prospect>;
}) {
  const router = useRouter();
  const [cadence, setCadence] = useState<CadenceWithSteps>(initialCadence);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // ----- Header (top-level cadence fields) -----
  async function handleHeaderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingHeader(true);
    setHeaderError(null);
    const res = await fetch(`/api/cadences/${cadence.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cadence.name,
        description: cadence.description,
        brand_kit_id: cadence.brand_kit_id,
        is_active: cadence.is_active,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setHeaderError(data.error ?? "Failed to save.");
      setSavingHeader(false);
      return;
    }
    setCadence({ ...data.cadence, steps: cadence.steps });
    setSavingHeader(false);
  }

  // ----- Step add -----
  const [newDelayDays, setNewDelayDays] = useState(0);
  const [newDelayHours, setNewDelayHours] = useState(0);
  const [newSubject, setNewSubject] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    if (!newPrompt.trim()) {
      setStepError("Draft prompt is required.");
      return;
    }
    setAddingStep(true);
    setStepError(null);
    const res = await fetch(`/api/cadences/${cadence.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delay_days: newDelayDays,
        delay_hours: newDelayHours,
        draft_prompt: newPrompt.trim(),
        subject_template: newSubject.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStepError(data.error ?? "Failed to add step.");
      setAddingStep(false);
      return;
    }
    setCadence({ ...cadence, steps: [...cadence.steps, data.step] });
    setNewDelayDays(cadence.steps.length === 0 ? 0 : 3);
    setNewDelayHours(0);
    setNewSubject("");
    setNewPrompt("");
    setAddingStep(false);
  }

  // ----- Step delete -----
  async function handleDeleteStep(stepId: number) {
    if (!confirm("Delete this step? Remaining steps will be renumbered.")) return;
    const res = await fetch(`/api/cadences/${cadence.id}/steps/${stepId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Failed to delete step.");
      return;
    }
    // Pull fresh cadence so renumbered step_numbers are accurate.
    router.refresh();
  }

  // ----- Delete cadence -----
  async function handleDeleteCadence() {
    if (!confirm(`Delete cadence "${cadence.name}"? All enrollments will be cancelled.`)) return;
    const res = await fetch(`/api/cadences/${cadence.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete cadence.");
      return;
    }
    router.push("/cadences");
  }

  const brandKitLabel =
    brandKits.find((k) => k.id === cadence.brand_kit_id)?.name ?? "no voice";
  const activeCount = enrollments.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-10">
      {/* ===== Header form ===== */}
      <section>
        <form onSubmit={handleHeaderSubmit} className="space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={cadence.name}
              onChange={(e) => setCadence({ ...cadence, name: e.target.value })}
              className={inputClasses}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={cadence.description}
              onChange={(e) => setCadence({ ...cadence, description: e.target.value })}
              className={`${inputClasses} min-h-[60px] resize-y`}
            />
          </Field>
          <Field label="Voice">
            <select
              value={cadence.brand_kit_id ?? ""}
              onChange={(e) =>
                setCadence({
                  ...cadence,
                  brand_kit_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClasses}
            >
              <option value="">— No brand kit (generic voice) —</option>
              {brandKits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.is_studio_self ? " (studio)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cadence.is_active}
              onChange={(e) => setCadence({ ...cadence, is_active: e.target.checked })}
            />
            Active (new enrollments allowed)
          </label>
          {headerError && <p className="text-sm text-red-600">{headerError}</p>}
          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={savingHeader}
              className="bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {savingHeader ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDeleteCadence}
              className="text-sm text-red-600 hover:underline"
            >
              Delete cadence
            </button>
          </div>
        </form>
      </section>

      {/* ===== Steps ===== */}
      <section>
        <h2 className="text-xl font-serif mb-1">Steps</h2>
        <p className="text-sm text-muted mb-4">
          Steps run in order from enrollment. Delays are relative to the previous step.
        </p>

        {cadence.steps.length === 0 ? (
          <p className="text-sm text-muted italic mb-6">
            No steps yet — add the first touchpoint below.
          </p>
        ) : (
          <ol className="space-y-4 mb-6">
            {cadence.steps.map((step) => (
              <StepCard
                key={step.id}
                cadenceId={cadence.id}
                step={step}
                onChanged={() => router.refresh()}
                onDelete={() => handleDeleteStep(step.id)}
              />
            ))}
          </ol>
        )}

        {/* Add new step */}
        <form
          onSubmit={handleAddStep}
          className="border border-border rounded p-4 space-y-3 bg-surface"
        >
          <p className="text-sm font-medium">
            Step {cadence.steps.length + 1}
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">After</span>
            <input
              type="number"
              min={0}
              value={newDelayDays}
              onChange={(e) => setNewDelayDays(Number(e.target.value))}
              className={numberInputClasses}
            />
            <span className="text-muted">days</span>
            <input
              type="number"
              min={0}
              max={23}
              value={newDelayHours}
              onChange={(e) => setNewDelayHours(Number(e.target.value))}
              className={numberInputClasses}
            />
            <span className="text-muted">hours</span>
            <span className="text-muted text-xs">
              {cadence.steps.length === 0 ? "after enrollment" : "after previous step"}
            </span>
          </div>
          <Field label="Subject template (optional)">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Leave blank to let Claude draft the subject"
              className={inputClasses}
            />
          </Field>
          <Field label="Draft prompt">
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder={
                cadence.steps.length === 0
                  ? "e.g. First-touch outreach. Reference what their studio does, why we're a fit, propose a 15-min intro call."
                  : "e.g. Polite follow-up after no reply. Restate the value prop in one sentence and ask if a different time works."
              }
              className={`${inputClasses} min-h-[100px] resize-y`}
            />
          </Field>
          {stepError && <p className="text-sm text-red-600">{stepError}</p>}
          <button
            type="submit"
            disabled={addingStep}
            className="bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {addingStep ? "Adding…" : "Add step"}
          </button>
        </form>
      </section>

      {/* ===== Enrollments ===== */}
      <section>
        <h2 className="text-xl font-serif mb-1">Enrollments</h2>
        <p className="text-sm text-muted mb-4">
          {activeCount} active · {enrollments.length} total ·{" "}
          <span className="text-muted">voice: {brandKitLabel}</span>
        </p>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted italic">
            Nobody enrolled yet. Enroll from a prospect's detail page.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {enrollments.map((e) => {
              const prospect = prospectsById[e.prospect_id];
              return (
                <li key={e.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <a
                      href={`/pipeline/${e.prospect_id}`}
                      className="font-medium hover:underline"
                    >
                      {prospect?.business_name ?? `Prospect #${e.prospect_id}`}
                    </a>
                    <p className="text-xs text-muted mt-0.5">
                      Step {e.current_step} of {cadence.steps.length}
                      {e.next_send_at && (
                        <>
                          {" · "}
                          next: {new Date(e.next_send_at).toLocaleString()}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-xs uppercase tracking-wider ${
                      e.status === "active"
                        ? "text-accent"
                        : e.status === "completed"
                          ? "text-muted"
                          : "text-muted italic"
                    }`}
                  >
                    {e.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============ Step card (inline editable) ============

function StepCard({
  cadenceId,
  step,
  onChanged,
  onDelete,
}: {
  cadenceId: number;
  step: CadenceStep;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [delayDays, setDelayDays] = useState(step.delay_days);
  const [delayHours, setDelayHours] = useState(step.delay_hours);
  const [subject, setSubject] = useState(step.subject_template ?? "");
  const [prompt, setPrompt] = useState(step.draft_prompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!prompt.trim()) {
      setError("Draft prompt is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/cadences/${cadenceId}/steps/${step.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delay_days: delayDays,
        delay_hours: delayHours,
        subject_template: subject.trim() || null,
        draft_prompt: prompt.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to save step.");
      setSaving(false);
      return;
    }
    setEditing(false);
    setSaving(false);
    onChanged();
  }

  if (!editing) {
    return (
      <li className="border border-border rounded p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium">
              Step {step.step_number}
              <span className="text-muted font-normal ml-2">
                · {formatStepDelay(step)}
                {step.step_number > 1 ? " after previous" : " after enrollment"}
              </span>
            </p>
            {step.subject_template && (
              <p className="text-sm text-muted mt-2">
                <span className="uppercase tracking-wider text-xs mr-2">Subject:</span>
                {step.subject_template}
              </p>
            )}
            <p className="text-sm mt-2 whitespace-pre-wrap">{step.draft_prompt}</p>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <button
              onClick={() => setEditing(true)}
              className="text-muted hover:text-foreground hover:underline"
            >
              Edit
            </button>
            <button onClick={onDelete} className="text-red-600 hover:underline">
              Delete
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="border border-accent rounded p-4 space-y-3 bg-surface">
      <p className="text-sm font-medium">Step {step.step_number} (editing)</p>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">After</span>
        <input
          type="number"
          min={0}
          value={delayDays}
          onChange={(e) => setDelayDays(Number(e.target.value))}
          className={numberInputClasses}
        />
        <span className="text-muted">days</span>
        <input
          type="number"
          min={0}
          max={23}
          value={delayHours}
          onChange={(e) => setDelayHours(Number(e.target.value))}
          className={numberInputClasses}
        />
        <span className="text-muted">hours</span>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Subject template (optional)</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClasses}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Draft prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={`${inputClasses} min-h-[100px] resize-y`}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-accent text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setDelayDays(step.delay_days);
            setDelayHours(step.delay_hours);
            setSubject(step.subject_template ?? "");
            setPrompt(step.draft_prompt);
            setError(null);
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </li>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
