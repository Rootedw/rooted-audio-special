import { getChatGPTUser } from "../../../chatgpt-auth";
import { isOwner } from "../../../../lib/access";
import { grantEntitlement } from "../../../../lib/entitlements";
import { isProductId } from "../../../../lib/products";
import { createAdminClient } from "../../../../lib/standalone/admin-server";
import { isSameOriginMutation } from "../../../../lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Not found" }, { status: 404 });
  const user = await getChatGPTUser();
  if (!user || !isOwner(user)) return Response.json({ error: "Not found" }, { status: 404 });
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return Response.json({ error: "Invalid request" }, { status: 415 });
  }
  const body = await request.json().catch(() => null) as { email?: string; productId?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const productId = body?.productId || "";
  if (!email || !isProductId(productId)) {
    return Response.json({ error: "Invalid entitlement" }, { status: 400 });
  }

  const admin = createAdminClient();
  let accountId = "";
  for (let page = 1; page <= 10 && !accountId; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return Response.json({ error: "Account lookup unavailable" }, { status: 503 });
    accountId = data.users.find((candidate) => candidate.email?.toLowerCase() === email)?.id || "";
    if (data.users.length < 100) break;
  }
  if (!accountId) return Response.json({ error: "ACCOUNT_HAS_NOT_SIGNED_IN" }, { status: 409 });
  await grantEntitlement(accountId, productId, `manual:${email}:${productId}`);
  return Response.json({ granted: true, email, productId });
}
