import { isSameOriginMutation } from "../../../lib/request-security";
import {readAccountState,writeAccountState} from '../../../lib/standalone/preferences';
import { getChatGPTUser } from "../../chatgpt-auth";
import { AUDIOBOOK_PRODUCT, hasEntitlement } from "../../../lib/access";

import { SPECIAL_PRODUCT } from "../../../lib/special-sales";

export const dynamic = "force-dynamic";

const allowedKeys = new Set([
  "ra-language", "ra-name", "ra-onboarded", "ra-intro-seen",
  "ra-active-track", "ra-favorites", "ra-reflections",
  "ra-reflection-times", "ra-workbook", "ra-listening-ritual",
  "ra-auto-continue", "ra-sleep-timer", "ra-volume",
  "ra-playback-speed", "ra-playback", "ra-saved-moments", "ra-workbook-section",
]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasEntitlement(user, AUDIOBOOK_PRODUCT))) return Response.json({ error: "Product access required" }, { status: 403 });
  try {
    const stored=await readAccountState(user.userId);
    const bundle=await hasEntitlement(user,SPECIAL_PRODUCT);
    const state=Object.fromEntries(Object.entries(stored).filter(([key])=>allowedKeys.has(key)&&(!['ra-workbook','ra-workbook-section'].includes(key)||bundle)));
    return Response.json({state},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Storage unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

export async function PUT(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasEntitlement(user, AUDIOBOOK_PRODUCT))) return Response.json({ error: "Product access required" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { key?: string; value?: unknown } | null;
  if (!body?.key || !allowedKeys.has(body.key)) {
    return Response.json({ error: "Invalid preference" }, { status: 400 });
  }
  if (["ra-workbook", "ra-workbook-section"].includes(body.key) && !(await hasEntitlement(user, SPECIAL_PRODUCT))) {
    return Response.json({ error: "Workbook unavailable for this account" }, { status: 403 });
  }
  const serialized = JSON.stringify(body.value);
  if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > 1_000_000) return Response.json({ error: "Invalid preference size" }, { status: 413 });
  try {
    await writeAccountState(user.userId,body.key,body.value);
    return Response.json({saved:true},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Storage unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
