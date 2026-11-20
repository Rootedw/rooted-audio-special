import { resolveMollieConfiguration } from "../mollie-configuration";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient<any> | null = null;

export function createAdminClient() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Admin storage unavailable");
  cached = createClient<any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

export function mollieConfiguration(mode?: 'test' | 'live') {
  return resolveMollieConfiguration({
    MOLLIE_API_KEY: process.env.MOLLIE_API_KEY,
    MOLLIE_LIVE_API_KEY: process.env.MOLLIE_LIVE_API_KEY,
    MOLLIE_LIVE_ENABLED: mode === undefined ? process.env.MOLLIE_LIVE_ENABLED : String(mode === 'live'),
  });
}
