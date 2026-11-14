export const SPECIAL_PRODUCT = "rooted-audio-special";
export const SPECIAL_AMOUNT = "24.05";

const defaultOpens = "2026-11-20T00:00:00+01:00";
const defaultCloses = "2026-11-28T00:00:00+01:00";

export function specialSalesOpen(now = Date.now()) {
  const opens = Date.parse(process.env.ROOTED_SPECIAL_OPENS_AT ?? defaultOpens);
  const closes = Date.parse(process.env.ROOTED_SPECIAL_CLOSES_AT ?? defaultCloses);
  return now >= opens && now < closes;
}
