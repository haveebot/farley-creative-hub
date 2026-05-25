/**
 * POST /api/cadences/from-template
 *
 * Clone a cadence template into a real cadence + steps in the DB.
 * The created cadence is editable just like any hand-built one.
 *
 * Body:
 *   {
 *     "template_id": "intro-3-touch",
 *     "brand_kit_id": 1            // optional; defaults to studio kit
 *   }
 *
 * Returns the new cadence (with steps embedded).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getCadenceTemplate } from "@/lib/cadence-templates";
import {
  createCadence,
  createStep,
  getCadenceWithSteps,
} from "@/lib/db/cadences";
import { getStudioKit } from "@/lib/db/brand-kits";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const templateId = typeof body.template_id === "string" ? body.template_id : "";
  const template = getCadenceTemplate(templateId);
  if (!template) {
    return NextResponse.json(
      { ok: false, error: "unknown-template", template_id: templateId },
      { status: 400 },
    );
  }

  // Default brand_kit_id to the studio kit if not specified.
  let brandKitId: number | null = null;
  if (typeof body.brand_kit_id === "number") {
    brandKitId = body.brand_kit_id;
  } else {
    const studio = await getStudioKit().catch(() => null);
    brandKitId = studio?.id ?? null;
  }

  const createdBy = auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;

  try {
    const cadence = await createCadence({
      name: template.name,
      description: template.description,
      brand_kit_id: brandKitId,
      created_by: createdBy,
    });

    for (let i = 0; i < template.steps.length; i++) {
      const s = template.steps[i];
      await createStep({
        cadence_id: cadence.id,
        step_number: i + 1,
        delay_days: s.delay_days,
        delay_hours: s.delay_hours,
        draft_prompt: s.draft_prompt,
        subject_template: s.subject_template ?? null,
      });
    }

    const withSteps = await getCadenceWithSteps(cadence.id);
    return NextResponse.json({ ok: true, cadence: withSteps });
  } catch (err) {
    console.error("[api/cadences/from-template] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
