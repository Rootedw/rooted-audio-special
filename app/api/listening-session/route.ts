import { TRACKS } from "../../../lib/tracks";
import { hasEntitlement } from "../../../lib/access";
import { isSameOriginMutation } from "../../../lib/request-security";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  claimListeningSession,
  ListeningAccessError,
  releaseListeningSession,
  removeTrustedDevice,
} from "../../../lib/listening-access";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof ListeningAccessError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  return Response.json({ error: "ACCESS_UNAVAILABLE" }, { status: 503 });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    action?: "heartbeat" | "stop";
    deviceId?: string;
    deviceLabel?: string;
    trackId?: string;
  } | null;
  if (!body?.deviceId) return Response.json({ error: "INVALID_DEVICE" }, { status: 400 });
  try {
    if (body.action === "stop") {
      await releaseListeningSession(user, body.deviceId);
    } else {
      if (!body.trackId || !TRACKS[body.trackId]) return Response.json({ error: "INVALID_TRACK" }, { status: 400 });
      if (!(await hasEntitlement(user, TRACKS[body.trackId].product))) return Response.json({ error: "PRODUCT_ACCESS_REQUIRED" }, { status: 403 });
      await claimListeningSession(user, body.deviceId, body.trackId, body.deviceLabel);
    }
    return Response.json({ allowed: true });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const deviceId = new URL(request.url).searchParams.get("device") || "";
  try {
    await removeTrustedDevice(user, deviceId);
    return Response.json({ removed: true });
  } catch (error) {
    return failure(error);
  }
}