import { getChatGPTUser } from '../../../chatgpt-auth';
import { hasEntitlement } from '../../../../lib/access';
import { claimListeningSession, ListeningAccessError } from '../../../../lib/listening-access';
import { TRACKS } from '../../../../lib/tracks';
import { fetchPrivateMedia } from '../../../../lib/standalone/private-media';
import { AUDIO_BUCKET, privateMediaResponse, mediaError } from '../../../../lib/standalone/media-policy';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await context.params;
  const track = Object.hasOwn(TRACKS, trackId) ? TRACKS[trackId] : undefined;
  if (!track || !/^(foreword|chapter-(0[1-9]|1[0-3]))$/.test(trackId)) return mediaError(404, 'INVALID_TRACK');
  const user = await getChatGPTUser();
  if (!user) return mediaError(401, 'UNAUTHORIZED');
  if (!(await hasEntitlement(user, track.product))) return mediaError(403, 'PRODUCT_ACCESS_REQUIRED');
  const url = new URL(request.url);
  try {
    await claimListeningSession(user, url.searchParams.get('device') || '', trackId, url.searchParams.get('label') || 'Personal device');
    const upstream = await fetchPrivateMedia(AUDIO_BUCKET, `${trackId}.mp3`, request);
    return privateMediaResponse(upstream, 'audio/mpeg');
  } catch (error) {
    return error instanceof ListeningAccessError
      ? mediaError(error.status, error.code)
      : mediaError(503, 'MEDIA_UNAVAILABLE');
  }
}
