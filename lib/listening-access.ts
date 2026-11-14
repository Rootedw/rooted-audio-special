import { createAccountClient } from './standalone/auth-server';
import type { ChatGPTUser } from '../app/chatgpt-auth';

export class ListeningAccessError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
function validDevice(value: string) { return /^[A-Za-z0-9_-]{16,96}$/.test(value); }
async function rpc(name: string, args: Record<string, string> = {}) {
  const client = await createAccountClient();
  const { data, error } = await client.rpc(name, args);
  if (error) throw new ListeningAccessError(503, 'ACCESS_UNAVAILABLE');
  return data;
}
export async function claimListeningSession(_user: ChatGPTUser, deviceId: string, trackId: string, label = 'Personal device') {
  if (!validDevice(deviceId)) throw new ListeningAccessError(400, 'INVALID_DEVICE');
  const code = await rpc('ra_claim_listening_session', {
    device: deviceId, track: trackId, device_label: label.trim().slice(0, 60) || 'Personal device',
  });
  if (code !== 'OK') {
    const conflict = code === 'DEVICE_LIMIT_REACHED' || code === 'ANOTHER_DEVICE_IS_LISTENING';
    throw new ListeningAccessError(conflict ? 409 : 403, typeof code === 'string' ? code : 'ACCESS_UNAVAILABLE');
  }
}
export async function releaseListeningSession(_user: ChatGPTUser, deviceId: string) {
  if (!validDevice(deviceId)) return;
  await rpc('ra_release_listening_session', { device: deviceId });
}
export async function listTrustedDevices(_user: ChatGPTUser) {
  const devices = await rpc('ra_list_trusted_devices');
  if (!Array.isArray(devices)) throw new ListeningAccessError(503, 'ACCESS_UNAVAILABLE');
  return devices as Array<{ device_id: string; label: string; created_at: string; last_seen_at: string }>;
}
export async function removeTrustedDevice(_user: ChatGPTUser, deviceId: string) {
  if (!validDevice(deviceId)) throw new ListeningAccessError(400, 'INVALID_DEVICE');
  await rpc('ra_remove_trusted_device', { device: deviceId });
}
