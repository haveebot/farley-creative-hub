/**
 * Voice profiles — shared types (client-safe, no DB imports).
 *
 * A voice profile is a reusable "how to sound" — independent of any
 * visual brand kit. Multiple voice profiles can exist (her studio voice,
 * her sales voice, a client's voice, an outreach voice). A draft picks
 * a voice profile to apply.
 */

export type VoiceProfile = {
  id: number;
  name: string;
  description: string;
  voice_notes: string;
  writing_samples: string;
  always_say: string[];
  never_say: string[];
  audience_persona: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type VoiceProfileCreate = {
  name: string;
  description?: string;
  voice_notes?: string;
  writing_samples?: string;
  always_say?: string[];
  never_say?: string[];
  audience_persona?: string;
  is_default?: boolean;
};

export type VoiceProfileUpdate = Partial<VoiceProfileCreate>;

/**
 * Common starter templates for the "create voice profile" flow.
 */
export const VOICE_PROFILE_TEMPLATES: Array<{
  slug: string;
  name: string;
  description: string;
}> = [
  {
    slug: "studio",
    name: "Studio voice",
    description: "The agency speaking to prospective clients and on public-facing surfaces.",
  },
  {
    slug: "sales",
    name: "Sales voice",
    description: "Outbound, pipeline replies, and warm intros. Direct, specific, low fluff.",
  },
  {
    slug: "etsy",
    name: "Etsy listing voice",
    description: "Product copy for Etsy listings — descriptive, evocative, search-friendly.",
  },
  {
    slug: "social",
    name: "Social voice",
    description: "Short-form social posts. Conversational, in-jokes welcome.",
  },
  {
    slug: "email",
    name: "Email voice",
    description: "1:1 customer + client emails. Warm, specific, ends with a clear next step.",
  },
];
