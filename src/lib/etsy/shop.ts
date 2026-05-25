/**
 * Etsy shop-scoped read helpers: shipping profiles, return policies.
 * The connected shop_id is resolved automatically from the active
 * etsy_connections row.
 */

import { etsyFetch } from "./client";
import { getActiveConnection } from "@/lib/db/etsy";

export type ShippingProfile = {
  shipping_profile_id: number;
  title: string;
  user_id: number;
  origin_country_iso: string;
  primary_cost: { amount: number; divisor: number; currency_code: string };
  secondary_cost: { amount: number; divisor: number; currency_code: string };
  min_processing_days: number | null;
  max_processing_days: number | null;
};

export type ReturnPolicy = {
  return_policy_id: number;
  accepts_returns: boolean;
  accepts_exchanges: boolean;
  return_deadline: number | null;
};

async function requireShopId(): Promise<number> {
  const conn = await getActiveConnection();
  if (!conn?.shop_id) {
    throw new Error("No connected Etsy shop. Connect at /settings/etsy.");
  }
  return conn.shop_id;
}

export async function listShippingProfiles(): Promise<ShippingProfile[]> {
  const shopId = await requireShopId();
  const res = await etsyFetch<{ results: ShippingProfile[] }>(
    `/application/shops/${shopId}/shipping-profiles`,
  );
  return res.results ?? [];
}

export async function listReturnPolicies(): Promise<ReturnPolicy[]> {
  const shopId = await requireShopId();
  const res = await etsyFetch<{ results: ReturnPolicy[] }>(
    `/application/shops/${shopId}/policies/return`,
  );
  return res.results ?? [];
}
