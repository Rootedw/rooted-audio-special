// Node migration bridge. No D1 database or asset fetcher is fabricated.
// Pending Postgres/storage adapters fail closed through existing route checks.
export const env: Cloudflare.Env = {
  ROOTED_AUDIO_OWNER_EMAIL: undefined,
  MOLLIE_API_KEY: undefined,
  MOLLIE_LIVE_ENABLED: 'false',
};
