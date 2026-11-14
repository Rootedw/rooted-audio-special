import { STANDARD_PURCHASE_PRICES } from "../../../lib/account-pricing";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getEntitlements } from "../../../lib/access";
import { listTrustedDevices } from "../../../lib/listening-access";
import { mollieConfiguration } from "../../../lib/standalone/admin-server";
import { claimGuestOrders } from "../../../lib/standalone/guest-payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await claimGuestOrders(user.userId);
  const [products, devices] = await Promise.all([
    getEntitlements(user),
    listTrustedDevices(user).catch(() => []),
  ]);
  return Response.json({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    products,
    devices: devices.map((device) => ({
      id: device.device_id,
      label: device.label,
      createdAt: device.created_at,
      lastSeenAt: device.last_seen_at,
    })),
    deviceLimit: 2,
    concurrentStreams: 1,
    checkoutAvailable: mollieConfiguration().checkoutAvailable,
    purchasePrices: STANDARD_PURCHASE_PRICES,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
