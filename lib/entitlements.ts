import { createAdminClient } from "./standalone/admin-server";

export async function grantEntitlement(userId: string, productId: string, sourceId: string) {
  const { error } = await createAdminClient().rpc("ra_grant_entitlement", {
    account: userId,
    product: productId,
    source: sourceId,
  });
  if (error) throw new Error("Entitlement storage unavailable");
}

export async function revokeEntitlementSource(userId: string, productId: string, sourceId: string) {
  const { error } = await createAdminClient().rpc("ra_revoke_entitlement_source", {
    account: userId,
    product: productId,
    source: sourceId,
  });
  if (error) throw new Error("Entitlement storage unavailable");
}
