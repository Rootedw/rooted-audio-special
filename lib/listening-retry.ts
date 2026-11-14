// Retry temporary service/network failures within the 90-second listening lease.
// Authentication, ownership and device conflicts must stop immediately.
export async function retryListeningRequest(
  send: () => Promise<Response | null>,
  cancelled: () => boolean,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 2000)),
): Promise<Response | null> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (cancelled()) return null;
    response = await send();
    if (response && response.status !== 429 && response.status < 500) return response;
    if (attempt < 2) await pause();
  }
  return response;
}
