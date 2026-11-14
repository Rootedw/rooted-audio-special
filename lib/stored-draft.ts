export type StoredDraft<T> = { __raDraft: 1; value: T; pending: boolean };
export function readDraft<T>(raw: string | null): StoredDraft<T> | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.__raDraft === 1 && typeof parsed.pending === "boolean" && "value" in parsed) return parsed as StoredDraft<T>;
    return { __raDraft: 1, value: parsed as T, pending: false };
  } catch { return null; }
}
export function makeDraft<T>(value: T, pending: boolean): string {
  return JSON.stringify({ __raDraft: 1, value, pending });
}
export function resolveStoredValue<T>(draft: StoredDraft<T> | null, cloud: Record<string, unknown>, key: string, initial: T): T {
  // A locally pending change has not been acknowledged by the server.
  if (draft?.pending) return draft.value;
  return key in cloud ? cloud[key] as T : draft ? draft.value : initial;
}
export function acknowledgeDraft(raw: string | null, acknowledgedValue: unknown): string | null {
  const draft = readDraft(raw);
  if (!draft || JSON.stringify(draft.value) !== JSON.stringify(acknowledgedValue)) return null;
  return makeDraft(draft.value, false);
}
