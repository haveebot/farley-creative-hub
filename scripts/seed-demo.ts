/**
 * Demo seed — populates a fresh demo deployment's DB with realistic
 * sample content so visitors to fcdemohub.com see a working firm.
 *
 * Usage (against the demo Neon branch):
 *   node --env-file=.env.demo --import tsx scripts/seed-demo.ts
 *
 * Idempotent: deletes all existing rows from the seed-managed tables
 * (in dependency order) and re-inserts a fresh fixture. Safe to re-run
 * to reset the demo to a clean state.
 *
 * Tables touched (in this order):
 *   prospect_sends → prospect_enrollments → cadence_steps → cadences
 *   prospect_activity → prospect_contacts → prospects → leads
 *   listings → drafts → assets → daily_briefings
 *   brand_kits (studio + clients) → hub_preferences (1 row)
 *
 * Does NOT touch: users (operator account), agent_tokens,
 * workspace_connections, etsy_connections. Those are env/operator
 * concerns and should be set fresh on the demo deployment.
 */

import { Client } from "pg";

const SAMPLE_PROSPECTS = [
  {
    business_name: "Lavender Lane Florals",
    industry: "food_beverage",
    size: "small",
    city: "Austin",
    state: "TX",
    website_url: "https://example.com",
    status: "discovery",
    service_interest: ["brand_identity", "packaging", "social_media"],
    notes: "Met at SXSW pop-up. Looking to refresh wedding-florist sub-brand.",
    next_action: "Send proposal for brand refresh",
    next_action_date_offset_days: 2,
    source: "event",
  },
  {
    business_name: "The Hemp Collect / Modern Herb Co",
    industry: "health_wellness",
    size: "medium",
    city: "Boulder",
    state: "CO",
    website_url: "https://example.com",
    status: "proposal",
    service_interest: ["brand_identity", "web_design", "content"],
    notes: "Hiring an Online Community Manager — strong signal they need outside brand help on launch comms.",
    next_action: "Follow up on proposal",
    next_action_date_offset_days: -1, // overdue
    source: "cold_outreach",
  },
  {
    business_name: "Morning Bird Inc.",
    industry: "retail",
    size: "small",
    city: "Brooklyn",
    state: "NY",
    website_url: "https://example.com",
    status: "contacted",
    service_interest: ["brand_identity", "packaging"],
    notes: "Ecommerce Brand Manager opening; D2C lifestyle brand.",
    next_action: "Discovery call this week",
    next_action_date_offset_days: 3,
    source: "cold_outreach",
  },
  {
    business_name: "Sunright",
    industry: "retail",
    size: "small",
    city: "Los Angeles",
    state: "CA",
    website_url: "https://example.com",
    status: "discovery",
    service_interest: ["marketing", "strategy"],
    notes: "Marketing Manager search; sunscreen + skincare line.",
    next_action: "Send three case studies",
    next_action_date_offset_days: 1,
    source: "referral",
  },
  {
    business_name: "The Ginger People",
    industry: "food_beverage",
    size: "medium",
    city: "Carmel Valley",
    state: "CA",
    website_url: "https://example.com",
    status: "negotiating",
    service_interest: ["brand_identity", "packaging", "web_design"],
    notes: "Director of Marketing pitch; full rebrand opportunity. Closest to signing.",
    next_action: "Contract review",
    next_action_date_offset_days: 0,
    source: "inbound",
  },
  {
    business_name: "Stonehenge Health",
    industry: "health_wellness",
    size: "medium",
    city: "Henderson",
    state: "NV",
    website_url: "https://example.com",
    status: "contacted",
    service_interest: ["content", "web_design"],
    notes: "Scaling creative function in-house; opportunity for project work on the gap.",
    next_action: "Initial call requested",
    next_action_date_offset_days: 5,
    source: "cold_outreach",
  },
  {
    business_name: "Green Valley Special Utility District",
    industry: "nonprofit",
    size: "small",
    city: "Wimberley",
    state: "TX",
    website_url: "https://example.com",
    status: "lead",
    service_interest: ["brand_identity", "content"],
    notes: "Communications specialist opening — public sector usually prefers project partnerships.",
    next_action: "Cold outreach",
    next_action_date_offset_days: 0,
    source: "cold_outreach",
  },
  {
    business_name: "Indigo Books",
    industry: "retail",
    size: "small",
    city: "Marfa",
    state: "TX",
    website_url: "https://example.com",
    status: "signed",
    service_interest: ["brand_identity", "packaging"],
    notes: "Signed two weeks ago. Independent bookstore brand refresh + retail packaging system.",
    next_action: "Kickoff scheduled",
    next_action_date_offset_days: null,
    source: "referral",
  },
  {
    business_name: "Bayou Bistro",
    industry: "food_beverage",
    size: "solo",
    city: "New Orleans",
    state: "LA",
    website_url: null,
    status: "passed",
    service_interest: [],
    notes: "Not a fit — too early-stage, budget too tight. Stay warm; revisit next year.",
    next_action: null,
    next_action_date_offset_days: null,
    source: "inbound",
  },
];

const SAMPLE_LEADS = [
  {
    source_type: "job_posting",
    source_url: "https://example.com",
    source_title: "Marketing Director",
    business_name: "Lizton Dairy Bar",
    city: "Lizton",
    state: "IN",
    industry: "food_beverage",
    size: "small",
    service_signal: ["marketing", "brand_identity"],
    raw_content: "Marketing Director role for a regional ice-cream chain; in-house team scaling from 2 to 5 over next 18 months.",
    notes: "Family-owned regional brand expanding marketing in-house — strong signal they need outside creative help on the scale-up.",
    status: "new",
    days_ago: 0,
  },
  {
    source_type: "job_posting",
    source_url: "https://example.com",
    source_title: "Brand Designer",
    business_name: "The Emily Program",
    city: "Saint Paul",
    state: "MN",
    industry: "health_wellness",
    size: "medium",
    service_signal: ["brand_identity", "web_design"],
    raw_content: "Brand Designer to support patient-facing brand work across digital + print collateral.",
    notes: "Patient-care org expanding brand function — relationship play, not transactional.",
    status: "new",
    days_ago: 0,
  },
  {
    source_type: "job_posting",
    source_url: "https://example.com",
    source_title: "Senior Copywriter",
    business_name: "Coterie",
    city: "New York",
    state: "NY",
    industry: "retail",
    size: "medium",
    service_signal: ["content", "brand_identity"],
    raw_content: "Senior Copywriter for a D2C wellness brand. Hybrid NYC.",
    notes: "Premium D2C wellness — Farley's voice would translate. Watch for editorial-led campaigns.",
    status: "new",
    days_ago: 1,
  },
  {
    source_type: "job_posting",
    source_url: "https://example.com",
    source_title: "Marketing Manager",
    business_name: "Casetify Studios",
    city: "Remote",
    state: null,
    industry: "retail",
    size: "medium",
    service_signal: ["marketing", "social_media", "content"],
    raw_content: "Marketing Manager role for design-led accessories brand.",
    notes: "Design-led accessories — strong creative-direction fit.",
    status: "reviewing",
    days_ago: 1,
  },
  {
    source_type: "job_posting",
    source_url: "https://example.com",
    source_title: "Brand Manager — Wedding Vertical",
    business_name: "Minted",
    city: "San Francisco",
    state: "CA",
    industry: "retail",
    size: "larger",
    service_signal: ["brand_identity", "marketing"],
    raw_content: "Brand Manager for Minted's wedding vertical.",
    notes: "Direct overlap with Farley's wedding-template audience. Worth a real pitch.",
    status: "qualified",
    days_ago: 2,
  },
  {
    source_type: "rfp",
    source_url: "https://example.com",
    source_title: "RFP — Visual Identity Refresh",
    business_name: "Texas Land Conservancy",
    city: "Dallas",
    state: "TX",
    industry: "nonprofit",
    size: "small",
    service_signal: ["brand_identity"],
    raw_content: "Public RFP for a visual identity refresh — 40-year-old nonprofit modernizing.",
    notes: "Local. Public-sector orgs often prefer project partnerships over full-time hires.",
    status: "qualified",
    days_ago: 3,
  },
  {
    source_type: "referral_mention",
    source_url: null,
    source_title: "Intro from Maddie at Field Trip",
    business_name: "Wandering Bookshop",
    city: "Asheville",
    state: "NC",
    industry: "retail",
    size: "solo",
    service_signal: ["brand_identity", "packaging"],
    raw_content: "Intro from Maddie — Wandering Bookshop opening a second location, wants a packaging system for their book-of-the-month subscription.",
    notes: "Warm intro. Match for the indie-retail packaging work Farley loves.",
    status: "new",
    days_ago: 4,
  },
  {
    source_type: "job_posting",
    source_url: "https://example.com",
    source_title: "Communications Lead",
    business_name: "Verdant Botanicals",
    city: "Portland",
    state: "OR",
    industry: "health_wellness",
    size: "small",
    service_signal: ["content", "social_media"],
    raw_content: "Communications Lead for herbal supplement brand.",
    notes: "Botanical / herbal — voice match.",
    status: "new",
    days_ago: 5,
  },
];

const SAMPLE_LISTINGS = [
  {
    working_name: "Botanical wedding invite suite — sage + cream",
    status: "approved",
    context_notes: "Watercolor botanical wedding invitation suite for garden / outdoor weddings. Includes save the date, invite, RSVP card, details card. Fully editable Canva templates.",
    title: "Botanical Wedding Invitation Suite Template, Editable Canva Watercolor Save the Date RSVP Details Card Garden Wedding Sage Cream Printable",
    description: "Made for the bride who wants every detail to feel intentional. This watercolor botanical suite was painted in-house and built for garden and outdoor weddings — the kind where the venue does half the work and the paper just needs to live up to it.\n\nWhat's included: save the date, main invitation, RSVP card, details card. Fully editable in Canva — bride personalizes wording, font sizes, and color accents before downloading high-res PDFs.\n\nThree color palettes included with this listing: sage + cream, blush + terracotta, deep emerald. Swap palettes from a single dropdown after purchase.\n\nDelivery: instant download. PDF files print beautifully on standard 5x7 invitation card stock. Editable Canva link delivered to your email within minutes of purchase.\n\nQuestions? Message the studio anytime before or after purchase — we answer every one personally.",
    tags: ["wedding invitation template", "watercolor wedding invite", "editable canva invite", "garden wedding suite", "botanical save the date", "printable rsvp card", "sage wedding stationery", "outdoor wedding invite", "watercolor stationery", "boho wedding suite", "wedding details card", "modern wedding template", "diy wedding stationery"],
    keywords: ["watercolor", "botanical", "canva template", "wedding stationery", "save the date", "RSVP card", "details card", "garden wedding", "fully editable", "instant download"],
  },
  {
    working_name: "Holiday card set — three patterns",
    status: "draft",
    context_notes: "Three holiday card designs — modern minimalist, vintage warm, hand-illustrated. Sold as a set.",
    title: "Holiday Card Set Editable Canva Templates Three Designs Modern Minimalist Vintage Hand Illustrated Christmas Printable Photo Card",
    description: "A trio of holiday card designs in one bundle — for the season when one card never feels like enough.\n\nThis set includes three distinct designs: a clean modern minimalist with type-led layout, a warm vintage palette with classic motifs, and a hand-illustrated card painted in-house. Mix and match across your list, or use one design for family and another for clients.\n\nFully editable in Canva. Add your photo, change the message, swap colors. Delivered as a Canva link plus print-ready PDFs at 5x7.\n\nDesigned for actual holiday card season — not the cardboard-feeling templates that get reposted year after year.",
    tags: ["holiday card template", "christmas card editable", "canva holiday template", "minimalist holiday card", "vintage christmas card", "hand illustrated card", "printable holiday card", "photo holiday card", "modern christmas card", "instant download card", "diy christmas card", "watercolor holiday card", "5x7 card template"],
    keywords: ["holiday cards", "Christmas template", "Canva editable", "vintage palette", "hand illustrated", "photo card", "modern minimalist", "5x7 print ready"],
  },
  {
    working_name: "Bridal shower invite — Italian villa",
    status: "posted",
    context_notes: "Italian villa themed bridal shower invitation. Warm tuscan palette. Editable Canva.",
    title: "Italian Villa Bridal Shower Invitation Template Tuscan Editable Canva Wine Olive Pasta Garden Party Printable",
    description: "Bridal shower invitation for the bride going Italian — whether that's a backyard pasta night or actually getting on a plane to Tuscany.\n\nWarm tuscan palette of terracotta, olive, deep wine. Hand-painted illustrations of olive branches and grape clusters frame the type. Fully editable in Canva — change the wording, swap dates and venue, adjust the palette if you want a cooler tone.\n\nIncluded: invitation (5x7), printable details card, matching thank-you card. PDF delivery.",
    tags: ["bridal shower invite", "italian themed invitation", "tuscan bridal shower", "garden party invite", "canva bridal template", "watercolor invitation", "olive branch invite", "wine themed invite", "editable shower invite", "printable bridal invite", "rustic bridal shower", "5x7 invitation", "instant download"],
    keywords: ["bridal shower", "Italian villa", "tuscan palette", "olive branch", "garden party", "editable Canva", "printable invitation", "watercolor"],
  },
];

const DRAFTED_EMAIL_BODIES = {
  intro_step1: "Hi Daniel,\n\nCame across your team's recent expansion announcement — congratulations on the new locations. I run Farley Creative Demo Studio, a brand and packaging shop based in Austin, and we work with retail brands at exactly this kind of inflection point.\n\nWatched a few of your shoppers in the original Wimberley spot last weekend; the visual identity is doing more work than the signage gives it credit for. Worth a 15-minute conversation about how that scales to the next two locations without losing the thread?\n\n— Demo Studio",
  intro_step2: "Daniel —\n\nQuick follow-up. The original note may have gotten buried under hiring stuff.\n\nIf brand-scaling-with-locations is the wrong fit right now, no worries. If it's close to the right time, I'd be glad to share two recent projects where we did exactly this kind of work — both regional retail, both expanding fast.\n\n— Demo Studio",
};

async function clearDemoData(c: Client) {
  // Order matters — children before parents.
  await c.query(`DELETE FROM prospect_sends`);
  await c.query(`DELETE FROM prospect_enrollments`);
  await c.query(`DELETE FROM cadence_steps`);
  await c.query(`DELETE FROM cadences`);
  await c.query(`DELETE FROM prospect_activity`);
  await c.query(`DELETE FROM prospect_contacts`);
  await c.query(`DELETE FROM prospects`);
  await c.query(`DELETE FROM leads`);
  await c.query(`DELETE FROM listings`);
  await c.query(`DELETE FROM drafts`);
  await c.query(`DELETE FROM assets`);
  await c.query(`DELETE FROM daily_briefings`);
  // Don't drop brand_kits — we update the studio kit in place. Client
  // kits get dropped + re-seeded.
  await c.query(`DELETE FROM brand_kits WHERE is_studio_self = FALSE`);
}

async function seedStudioKit(c: Client): Promise<number> {
  // Upsert the studio kit with demo-friendly content.
  const studio = await c.query<{ id: number }>(
    `SELECT id FROM brand_kits WHERE is_studio_self = TRUE LIMIT 1`,
  );
  let id: number;
  if (studio.rows[0]) {
    id = studio.rows[0].id;
  } else {
    const created = await c.query<{ id: number }>(
      `INSERT INTO brand_kits (name, is_studio_self) VALUES ('Farley Creative Demo Studio', TRUE) RETURNING id`,
    );
    id = created.rows[0].id;
  }

  await c.query(
    `UPDATE brand_kits
        SET name = $2,
            bio = $3,
            primary_color = $4,
            secondary_color = $5,
            accent_color = $6,
            voice_notes = $7,
            brand_book_notes = $8,
            writing_samples = $9,
            audience_persona = $10,
            differentiators = $11,
            always_say = $12,
            never_say = $13,
            etsy_shop_url = $14,
            website_url = $15
      WHERE id = $1`,
    [
      id,
      "Farley Creative Demo Studio",
      "A small brand-and-packaging studio. We work with small consumer brands at inflection points — new launches, scaling beyond one location, refreshes that need to last another decade.",
      "#1a1a1a",
      "#e6e2d8",
      "#c97d5d",
      "Warm and confident. Concrete over abstract. Never corporate or salesy. Writes like a craftsperson talking shop, not an agency pitching deck. Sentences earn their length.",
      "Studio works with retail, food/beverage, health/wellness, and arts brands. Always single-source illustration (hand-painted, not stock). Always palette-led rather than typography-led. Refreshes that age well, not redesigns that get redone.",
      "Example 1 — Etsy listing description:\nMade for the bride who wants every detail to feel intentional. This watercolor botanical suite was painted in-house and built for garden and outdoor weddings — the kind where the venue does half the work and the paper just needs to live up to it.\n\n---\n\nExample 2 — customer reply:\nHi Sarah — yes, totally doable. The color palette you mentioned would look gorgeous on this template; I can swap it before sending the final. Want me to send a preview before you download, or should I drop the final straight in?\n\n---\n\nExample 3 — Instagram caption:\nThree days, three trial runs of the same envelope flap. Worth it.",
      "Small-brand founders, marketing leads at scaling D2C brands, and design-literate clients who hire studios because they care about craft. Often 28-45. Allergic to corporate language. Notice when something is hand-made vs templated.",
      "Hand-painted (never stock illustration) brand work for small consumer brands at inflection points. Palette-led approach — every project gets a custom palette painted in-house, not pulled from a swatch library. Refreshes built to age well, not viral redesigns.",
      ["hand-painted", "made for", "watercolor", "fully editable", "in-house", "painted", "considered", "palette-led"],
      ["circle back", "looking forward to hearing from you", "exclusive offer", "just checking in", "exciting opportunity", "amazing", "let's get started"],
      "https://example.com/demo-shop",
      "https://fcdemohub.com",
    ],
  );
  return id;
}

async function seedHubPreferences(c: Client) {
  // Make sure the row exists, then set demo-appropriate values.
  await c.query(`INSERT INTO hub_preferences DEFAULT VALUES ON CONFLICT DO NOTHING`);
  await c.query(
    `UPDATE hub_preferences
        SET hub_label = 'Farley Creative Demo Hub',
            accent_color = '#c97d5d',
            theme = 'light',
            favicon_url = NULL`,
  );
}

async function seedProspects(c: Client) {
  for (const p of SAMPLE_PROSPECTS) {
    const nextActionDate =
      p.next_action_date_offset_days === null
        ? null
        : new Date(Date.now() + p.next_action_date_offset_days * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
    const row = await c.query<{ id: number }>(
      `INSERT INTO prospects
         (business_name, industry, size, city, state, website_url, status,
          service_interest, notes, next_action, next_action_date, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               COALESCE($8, '{}'::text[]), COALESCE($9, ''), $10, $11, $12)
       RETURNING id`,
      [
        p.business_name,
        p.industry,
        p.size,
        p.city,
        p.state,
        p.website_url,
        p.status,
        p.service_interest,
        p.notes,
        p.next_action,
        nextActionDate,
        p.source,
      ],
    );
    const prospectId = row.rows[0].id;

    // Add a primary contact for each.
    await c.query(
      `INSERT INTO prospect_contacts
         (prospect_id, name, email, role, is_primary, notes)
       VALUES ($1, $2, $3, $4, TRUE, '')`,
      [
        prospectId,
        `Daniel from ${p.business_name.split(" ")[0]}`,
        `daniel@${p.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
        "decision_maker",
      ],
    );

    // Log creation activity.
    await c.query(
      `INSERT INTO prospect_activity (prospect_id, kind, content, created_by, created_at)
       VALUES ($1, 'note', $2, 'demo:seed', NOW() - INTERVAL '14 days')`,
      [prospectId, `Added to pipeline.`],
    );
    if (p.status !== "lead") {
      await c.query(
        `INSERT INTO prospect_activity (prospect_id, kind, content, created_by, created_at)
         VALUES ($1, 'status_change', $2, 'demo:seed', NOW() - INTERVAL '7 days')`,
        [prospectId, `Status advanced to ${p.status}.`],
      );
    }
  }
}

async function seedLeads(c: Client) {
  for (const l of SAMPLE_LEADS) {
    await c.query(
      `INSERT INTO leads
         (source_type, source_url, source_title, business_name, city, state,
          industry, size, service_signal, raw_content, notes, status, found_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               COALESCE($9, '{}'::text[]), $10, $11, $12, 'demo:seed',
               NOW() - INTERVAL '1 day' * $13)`,
      [
        l.source_type,
        l.source_url,
        l.source_title,
        l.business_name,
        l.city,
        l.state,
        l.industry,
        l.size,
        l.service_signal,
        l.raw_content,
        l.notes,
        l.status,
        l.days_ago,
      ],
    );
  }
}

async function seedCadences(c: Client, studioKitId: number) {
  const intro = await c.query<{ id: number }>(
    `INSERT INTO cadences (name, description, brand_kit_id, is_active, created_by)
     VALUES ($1, $2, $3, TRUE, 'demo:seed')
     RETURNING id`,
    [
      "New-prospect 3-touch intro",
      "First-touch outreach + 2 follow-ups for fresh leads. 10-day arc.",
      studioKitId,
    ],
  );
  const introId = intro.rows[0].id;

  const introSteps = [
    {
      step_number: 1,
      delay_days: 0,
      delay_hours: 0,
      draft_prompt: "First-touch cold outreach. Reference something specific about the prospect. Soft 15-min ask. Three short paragraphs max.",
    },
    {
      step_number: 2,
      delay_days: 3,
      delay_hours: 0,
      draft_prompt: "Follow-up after no reply. Different angle. Under 80 words. Avoid 'just checking in'.",
    },
    {
      step_number: 3,
      delay_days: 4,
      delay_hours: 0,
      draft_prompt: "Soft breakup note. Keep door open. End with the studio's contact line.",
    },
  ];

  for (const s of introSteps) {
    await c.query(
      `INSERT INTO cadence_steps (cadence_id, step_number, delay_days, delay_hours, draft_prompt)
       VALUES ($1, $2, $3, $4, $5)`,
      [introId, s.step_number, s.delay_days, s.delay_hours, s.draft_prompt],
    );
  }

  const postDiscovery = await c.query<{ id: number }>(
    `INSERT INTO cadences (name, description, brand_kit_id, is_active, created_by)
     VALUES ($1, $2, $3, TRUE, 'demo:seed')
     RETURNING id`,
    [
      "Post-discovery follow-up",
      "After a first conversation. Recap, next steps, and a check-in if they go quiet.",
      studioKitId,
    ],
  );
  const postDiscoveryId = postDiscovery.rows[0].id;
  await c.query(
    `INSERT INTO cadence_steps (cadence_id, step_number, delay_days, delay_hours, draft_prompt)
     VALUES ($1, 1, 0, 2, 'Recap email within hours of discovery call. Three things heard. Next step.'),
            ($1, 2, 4, 0, 'Check-in if no reply. One specific easy-to-answer question.'),
            ($1, 3, 7, 0, 'Light final nudge. Offer to pause and circle back next quarter.')`,
    [postDiscoveryId],
  );

  // Enroll two prospects in the intro cadence with drafts in various states.
  const prospects = await c.query<{ id: number; business_name: string; email: string }>(
    `SELECT p.id, p.business_name, pc.email
       FROM prospects p
       JOIN prospect_contacts pc ON pc.prospect_id = p.id AND pc.is_primary
      WHERE p.business_name IN ('Morning Bird Inc.', 'Green Valley Special Utility District')`,
  );

  for (let i = 0; i < prospects.rows.length; i++) {
    const p = prospects.rows[i];
    const currentStep = i === 0 ? 1 : 0; // Morning Bird has step 1 drafted; Green Valley is fresh
    const enrollment = await c.query<{ id: number }>(
      `INSERT INTO prospect_enrollments
         (prospect_id, cadence_id, status, current_step, next_send_at, enrolled_by)
       VALUES ($1, $2, 'active', $3, NOW() + INTERVAL '1 day' * $4, 'demo:seed')
       RETURNING id`,
      [p.id, introId, currentStep, i === 0 ? 2 : 0],
    );
    const enrollmentId = enrollment.rows[0].id;

    // For Morning Bird (already past step 1) — show a drafted email
    // sitting in "Gmail Drafts" awaiting review.
    if (i === 0) {
      const step1 = await c.query<{ id: number; step_number: number }>(
        `SELECT id, step_number FROM cadence_steps WHERE cadence_id = $1 AND step_number = 1`,
        [introId],
      );
      await c.query(
        `INSERT INTO prospect_sends
           (enrollment_id, step_id, step_number, to_email, to_name, subject, body,
            status, send_via, scheduled_for, created_at)
         VALUES ($1, $2, 1, $3, $4, $5, $6, 'drafted', 'gmail',
                 NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours')`,
        [
          enrollmentId,
          step1.rows[0].id,
          p.email,
          p.business_name,
          `Quick read on your D2C expansion`,
          DRAFTED_EMAIL_BODIES.intro_step1,
        ],
      );
      await c.query(
        `INSERT INTO prospect_activity (prospect_id, kind, content, created_by, created_at)
         VALUES ($1, 'email_drafted', $2, 'cron:cadence-tick', NOW() - INTERVAL '5 hours')`,
        [p.id, `Cadence step 1: Quick read on your D2C expansion (review in Gmail Drafts)`],
      );
    }
  }
}

async function seedListings(c: Client, studioKitId: number) {
  for (const l of SAMPLE_LISTINGS) {
    await c.query(
      `INSERT INTO listings
         (working_name, brand_kit_id, context_notes, title, description, tags, keywords,
          status, ai_model_used, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'claude-sonnet-4-5', 'demo:seed',
               NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days')`,
      [
        l.working_name,
        studioKitId,
        l.context_notes,
        l.title,
        l.description,
        l.tags,
        l.keywords,
        l.status,
      ],
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Run with --env-file=.env.demo");
  }
  if (process.env.DEMO_MODE !== "true") {
    throw new Error(
      "DEMO_MODE !== 'true'. Refusing to run seed against a non-demo DB. Set DEMO_MODE=true in .env.demo.",
    );
  }

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  console.log("Connected to demo DB. Clearing existing seeded data…");
  await clearDemoData(c);
  console.log("Seeding studio brand kit…");
  const studioKitId = await seedStudioKit(c);
  console.log("Seeding hub preferences…");
  await seedHubPreferences(c);
  console.log("Seeding leads…");
  await seedLeads(c);
  console.log("Seeding prospects + contacts + activity…");
  await seedProspects(c);
  console.log("Seeding cadences + enrollments + drafts…");
  await seedCadences(c, studioKitId);
  console.log("Seeding listings…");
  await seedListings(c, studioKitId);
  console.log("Done. Demo DB ready.");
  await c.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
