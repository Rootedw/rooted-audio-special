export type CheckoutJourney = { view: "library" | "blueprint" | "space" | "profile" | "workbook"; scroll: number; player: boolean; savedAt: number };
export function readCheckoutJourney(raw: string | null, now = Date.now()): CheckoutJourney | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || !["library", "blueprint", "space", "profile", "workbook"].includes(value.view)
      || !Number.isFinite(value.scroll) || value.scroll < 0 || value.scroll > 1e7
      || typeof value.player !== "boolean" || !Number.isFinite(value.savedAt)
      || value.savedAt > now || now - value.savedAt > 24 * 60 * 60 * 1000) return null;
    return value;
  } catch { return null; }
}
