/* ------------------------------------------------------------------ */
/*  Margin-specific pure helpers                                       */
/* ------------------------------------------------------------------ */

export const COLOR_REVENUE = '#E63948'
export const COLOR_COST = '#F0642B'
export const COLOR_MARGIN_POS = '#28A36A'
export const COLOR_MARGIN_NEG = '#E63948'

/** Resolve cost rate for an consultant at a given YYYY-MM month key. */
export function getCostRateForMonth(
  rateMap: Map<string, Array<{ hourly_rate: number; effective_date: string }>>,
  consultantId: string,
  monthKey: string,
): number {
  const entries = rateMap.get(consultantId)
  if (!entries || entries.length === 0) return 0
  const targetDate = monthKey + '-01'
  const entry = entries.find(r => r.effective_date <= targetDate)
  return entry?.hourly_rate ?? 0
}
