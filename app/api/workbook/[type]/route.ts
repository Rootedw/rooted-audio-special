import { getChatGPTUser } from '../../../chatgpt-auth';
import { DEEPENING_PRODUCT, hasEntitlement } from '../../../../lib/access';
import { fetchPrivateMedia } from '../../../../lib/standalone/private-media';
import { WORKBOOK_BUCKET, WORKBOOK_FILES, privateMediaResponse, mediaError } from '../../../../lib/standalone/media-policy';

import { createAdminClient } from '../../../../lib/standalone/admin-server';
import { SPECIAL_PRODUCT } from '../../../../lib/special-sales';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  const special = type === 'special';
  const file = special ? 'journaling-workbook-de-shoraifa-methode.pdf' : Object.hasOwn(WORKBOOK_FILES, type) ? WORKBOOK_FILES[type] : undefined;
  if (!file) return mediaError(404, 'INVALID_WORKBOOK');
  const user = await getChatGPTUser();
  if (!user) return mediaError(401, 'UNAUTHORIZED');
  if (!(await hasEntitlement(user, special ? SPECIAL_PRODUCT : DEEPENING_PRODUCT))) return mediaError(403, 'PRODUCT_ACCESS_REQUIRED');
  try {
    if (special) {
      const { data, error } = await createAdminClient().storage.from(WORKBOOK_BUCKET).download(file);
      if (error || !data) return mediaError(503, 'MEDIA_UNAVAILABLE');
      return privateMediaResponse(new Response(data), 'application/pdf', `attachment; filename="${file}"`);
    }
    const upstream = await fetchPrivateMedia(WORKBOOK_BUCKET, file, request);
    const mode = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return privateMediaResponse(upstream, 'application/pdf', `${mode}; filename="${file}"`);
  } catch { return mediaError(503, 'MEDIA_UNAVAILABLE'); }
}
