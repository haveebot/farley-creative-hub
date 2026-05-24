/**
 * MCP server endpoint for Farley Creative Hub.
 *
 * Implements the Model Context Protocol over HTTP (JSON-RPC). Agents
 * connect by adding this URL as a custom MCP server in their Claude
 * config, with the bearer token in the Authorization header.
 *
 * Available tools (will grow as features land):
 *   - get_hub_preferences / update_hub_preferences
 *   - get_studio_brand_kit / update_studio_brand_kit
 *   - list_assets
 *
 * Bearer-token auth via the same agent_tokens table as the REST API.
 * Cookie auth isn't supported here — MCP clients send headers, not cookies.
 *
 * Protocol notes:
 * - JSON-RPC 2.0 over POST
 * - Methods handled: initialize, notifications/initialized, tools/list, tools/call
 * - Notifications (no `id`) return 204 No Content
 */

import { NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/db/agent-tokens";
import { getHubPreferences, updateHubPreferences } from "@/lib/db/hub-preferences";
import { getStudioKit, updateBrandKit } from "@/lib/db/brand-kits";
import { listAssets } from "@/lib/db/assets";
import {
  createDraft,
  DRAFT_KINDS,
  DRAFT_STATUSES,
  listDrafts,
  type DraftKind,
  type DraftStatus,
} from "@/lib/db/drafts";
import { draftWithClaude } from "@/lib/ai/claude";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "farley-creative-hub";
const SERVER_VERSION = "0.1.0";

const HEX_COLOR_OR_EMPTY = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

type ToolContext = { agentId: number; agentName: string };

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const TOOLS: ToolDef[] = [
  {
    name: "get_hub_preferences",
    description:
      "Read the Hub's look-and-feel settings (operator chrome): hub_label and accent_color. Returns the single hub_preferences row.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => getHubPreferences(),
  },
  {
    name: "update_hub_preferences",
    description:
      "Update the Hub's look-and-feel settings. Only pass fields you want to change. accent_color must be a hex value like #c97d5d.",
    inputSchema: {
      type: "object",
      properties: {
        hub_label: { type: "string" },
        accent_color: {
          type: "string",
          pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
        },
      },
    },
    handler: async (args) => {
      const updates: Record<string, string> = {};
      if (typeof args.hub_label === "string") updates.hub_label = args.hub_label;
      if (typeof args.accent_color === "string") updates.accent_color = args.accent_color;
      return updateHubPreferences(updates);
    },
  },
  {
    name: "get_studio_brand_kit",
    description:
      "Read the studio's brand kit — the studio's name, bio, voice notes, brand book notes, color palette (primary/secondary/accent), and social URLs. Use this to ground listing copy, customer messages, and any other voice-sensitive output.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => getStudioKit(),
  },
  {
    name: "update_studio_brand_kit",
    description:
      "Update the studio's brand kit. Pass only fields to change. Colors must be hex values or empty strings.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        bio: { type: "string" },
        primary_color: { type: "string" },
        secondary_color: { type: "string" },
        accent_color: { type: "string" },
        voice_notes: { type: "string" },
        brand_book_notes: { type: "string" },
        etsy_shop_url: { type: "string" },
        website_url: { type: "string" },
        instagram_url: { type: "string" },
        pinterest_url: { type: "string" },
      },
    },
    handler: async (args) => {
      const stringFields = [
        "name",
        "bio",
        "primary_color",
        "secondary_color",
        "accent_color",
        "voice_notes",
        "brand_book_notes",
        "etsy_shop_url",
        "website_url",
        "instagram_url",
        "pinterest_url",
      ];
      const updates: Record<string, string> = {};
      for (const f of stringFields) {
        if (typeof args[f] === "string") updates[f] = args[f] as string;
      }
      // Validate colors
      for (const f of ["primary_color", "secondary_color", "accent_color"] as const) {
        const v = updates[f];
        if (typeof v === "string" && !HEX_COLOR_OR_EMPTY.test(v)) {
          throw new Error(`${f.replace(/_/g, " ")} must be a hex value like #c97d5d, or empty`);
        }
      }
      const kit = await getStudioKit();
      return updateBrandKit(kit.id, updates as never);
    },
  },
  {
    name: "list_assets",
    description:
      "List assets in the studio's library — logos, brand books, design masters, design exports, or general files. Optionally filter by kind or by linked brand kit. Returns metadata + the public URL of each asset.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["general", "logo", "brand_book", "design_master", "design_export"],
        },
        brand_kit_id: { type: ["integer", "null"] },
      },
    },
    handler: async (args) => {
      const filter: { kind?: string; brand_kit_id?: number | null } = {};
      if (typeof args.kind === "string") filter.kind = args.kind;
      if (args.brand_kit_id !== undefined) {
        filter.brand_kit_id = args.brand_kit_id as number | null;
      }
      return listAssets(filter as never);
    },
  },
  {
    name: "list_drafts",
    description:
      "List drafts already in the Hub — Etsy listing copy, Pinterest pin captions, customer replies, social posts, blog drafts, email drafts. Optionally filter by status (draft/approved/published/archived) or kind. Use this before creating a new draft to avoid duplicates and to find drafts to refine.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: DRAFT_STATUSES as unknown as string[] },
        kind: { type: "string", enum: DRAFT_KINDS as unknown as string[] },
      },
    },
    handler: async (args) => {
      const filter: { status?: DraftStatus; kind?: DraftKind } = {};
      if (typeof args.status === "string") filter.status = args.status as DraftStatus;
      if (typeof args.kind === "string") filter.kind = args.kind as DraftKind;
      return listDrafts(filter);
    },
  },
  {
    name: "create_draft",
    description:
      "Create a draft in the Hub. Two modes: (1) pass a prompt and Claude drafts content grounded in the studio brand voice + brand book notes; (2) pass content directly to save text you've already drafted in the conversation. Provide a short title so it's findable later. Pick the correct kind so the draft formats appropriately. Drafts start in status 'draft' for review.",
    inputSchema: {
      type: "object",
      required: ["title", "kind"],
      properties: {
        title: {
          type: "string",
          description: "Short label for finding this draft later (not the output content).",
        },
        kind: {
          type: "string",
          enum: DRAFT_KINDS as unknown as string[],
          description:
            "What kind of draft: listing (Etsy), pin (Pinterest), customer_reply, social_post, blog, email, general.",
        },
        prompt: {
          type: "string",
          description:
            "What to draft (used if `content` is not provided). Claude will draft using the studio brand voice + brand book notes.",
        },
        content: {
          type: "string",
          description:
            "Pre-drafted content to save directly. If provided, skips the Claude call. Useful when you've already drafted in your conversation.",
        },
      },
    },
    handler: async (args, ctx) => {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      const kindRaw = typeof args.kind === "string" ? args.kind : "general";
      const kind: DraftKind = (DRAFT_KINDS as string[]).includes(kindRaw)
        ? (kindRaw as DraftKind)
        : "general";
      const prompt = typeof args.prompt === "string" ? args.prompt : "";
      const providedContent = typeof args.content === "string" ? args.content : null;

      if (!title) throw new Error("title is required");

      let content: string;
      let modelUsed: string | null = null;
      if (providedContent !== null) {
        content = providedContent;
      } else {
        if (!prompt) throw new Error("either prompt or content must be provided");
        const brand = await getStudioKit();
        const result = await draftWithClaude({ kind, prompt, brand });
        content = result.content;
        modelUsed = result.model;
      }

      const studio = await getStudioKit();
      return createDraft({
        title,
        kind,
        prompt,
        content,
        brand_kit_id: studio.id,
        model_used: modelUsed,
        created_by: `agent:${ctx.agentName}`,
      });
    },
  },
];

/**
 * Auth: extract + verify bearer token. Returns the agent record or
 * a Response (which the route should immediately return) on failure.
 */
async function authenticate(request: Request): Promise<{ tokenId: number; tokenName: string } | Response> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return jsonRpcError(null, -32001, "unauthorized — missing Bearer token", 401);
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return jsonRpcError(null, -32001, "unauthorized — empty token", 401);
  }
  const agent = await verifyAgentToken(token);
  if (!agent) {
    return jsonRpcError(null, -32001, "unauthorized — invalid token", 401);
  }
  return { tokenId: agent.id, tokenName: agent.name };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200, data?: unknown) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message, data } },
    { status },
  );
}

export async function POST(request: Request) {
  // Auth first — applies to every request after the initialize handshake.
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  let body: { jsonrpc?: string; method?: string; params?: Record<string, unknown>; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "parse error", 400);
  }

  const { method, params, id } = body;

  // Notifications (no id) return 204.
  const isNotification = id === undefined || id === null;

  if (!method) {
    if (isNotification) return new Response(null, { status: 204 });
    return jsonRpcError(id, -32600, "invalid request — missing method");
  }

  try {
    switch (method) {
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} },
        });

      case "notifications/initialized":
      case "notifications/cancelled":
        return new Response(null, { status: 204 });

      case "ping":
        return jsonRpcResult(id, {});

      case "tools/list":
        return jsonRpcResult(id, {
          tools: TOOLS.map(({ handler: _h, ...rest }) => rest),
        });

      case "tools/call": {
        const name = params?.name;
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        if (typeof name !== "string") {
          return jsonRpcError(id, -32602, "invalid params — name required");
        }
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          return jsonRpcError(id, -32601, `tool not found: ${name}`);
        }
        try {
          const result = await tool.handler(args, {
            agentId: authResult.tokenId,
            agentName: authResult.tokenName,
          });
          return jsonRpcResult(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          });
        } catch (err) {
          return jsonRpcResult(id, {
            content: [
              {
                type: "text",
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          });
        }
      }

      default:
        if (isNotification) return new Response(null, { status: 204 });
        return jsonRpcError(id, -32601, `method not found: ${method}`);
    }
  } catch (err) {
    console.error("[mcp] internal error", err);
    return jsonRpcError(id, -32603, `internal error: ${(err as Error).message}`);
  }
}

/**
 * GET responds with server info — useful for sanity-checking the URL
 * works without speaking MCP. Doesn't require auth so probes from a
 * browser show something.
 */
export async function GET() {
  return NextResponse.json({
    server: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: PROTOCOL_VERSION,
    transport: "streamable-http",
    note: "POST JSON-RPC 2.0 requests with `Authorization: Bearer <fch_…>` header.",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
