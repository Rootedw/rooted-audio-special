export type MollieEnvironment = {
  MOLLIE_API_KEY?: string;
  MOLLIE_LIVE_API_KEY?: string;
  MOLLIE_LIVE_ENABLED?: string;
};

// Activation and the public registration gate are deliberately independent.
// Production can verify a live purchase while only invited accounts have access.
export function resolveMollieConfiguration(environment: MollieEnvironment) {
  const liveEnabled = environment.MOLLIE_LIVE_ENABLED === "true";
  const apiKey = liveEnabled
    ? environment.MOLLIE_LIVE_API_KEY || environment.MOLLIE_API_KEY || ""
    : environment.MOLLIE_API_KEY || "";
  const requiredPrefix = liveEnabled ? "live_" : "test_";
  return {
    apiKey,
    checkoutAvailable: apiKey.startsWith(requiredPrefix) && apiKey.length > requiredPrefix.length,
    liveEnabled,
  };
}
