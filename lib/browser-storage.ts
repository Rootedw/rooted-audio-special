// Never read another customer's locally cached reflections or workbook.
export function accountStorageKey(userId: string, key: string): string {
  if (!userId) throw new Error("Verified account required for local storage");
  return `ra-account:${encodeURIComponent(userId)}:${key}`;
}
