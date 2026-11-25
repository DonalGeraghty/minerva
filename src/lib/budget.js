import { moneyCents } from './finance.js'

export const BUDGET_MODES = [
  { id: 'save_more', label: 'Save more', description: 'Tighter flexible spending' },
  { id: 'balanced', label: 'Balanced', description: 'A practical middle ground' },
  { id: 'breathing_room', label: 'More breathing room', description: 'More flexibility this month' },
]

export function centsText(cents) {
  if (!Number.isSafeInteger(cents)) throw new Error('This amount is outside the supported range.')
  const absolute = Math.abs(cents)
  return `${cents < 0 ? '-' : ''}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

export function budgetView(context, plan, mode = 'balanced', overrides = {}) {
  const actual = new Map(context.current_categories.map((row) => [row.category, row]))
  const proposed = new Map((plan?.approaches[mode]?.categories || []).map((row) => [row.category, row]))
  const names = new Set([...actual.keys(), ...proposed.keys()])
  const rows = [...names].map((category) => {
    const current = actual.get(category)
    const suggestion = proposed.get(category)
    const spent = moneyCents(current?.spent_eur || '0')
    const refunds = moneyCents(current?.refunds_eur || '0')
    const edited = Object.hasOwn(overrides, category)
    const limit = plan ? moneyCents(edited ? overrides[category] : suggestion?.limit_eur || '0') : null
    if (limit != null && limit < 0) throw new Error('Category limits cannot be negative.')
    const forecast = suggestion ? Math.max(spent, moneyCents(suggestion.forecast_eur)) : spent
    const remaining = limit == null ? null : limit - spent
    const protectedBill = suggestion ? moneyCents(suggestion.reserved_bills_eur) : 0
    // Category spending alone cannot prove that a particular bill was paid.
    // Keep its reserve until a reassessment incorporates the payment/correction.
    const protectedRemaining = protectedBill
    const weeks = Math.max(1, context.days_remaining) / 7
    return { category, spent, refunds, limit, forecast, remaining, edited, suggestion,
      weekly: remaining == null ? null : Math.min(Math.max(0, remaining), Math.round(Math.max(0, remaining) / weeks)),
      noAllowance: !!plan && !suggestion,
      protectedBill, protectedRemaining }
  }).filter((row) => row.suggestion || row.spent || row.refunds).sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category))
  const income = moneyCents(context.actual.income_eur)
  const spent = moneyCents(context.actual.spent_eur)
  const refunds = moneyCents(context.actual.refunds_eur)
  // Income arriving after assessment consumes the outstanding income forecast;
  // it is never counted once as actual and a second time as expected salary.
  const additionalIncome = plan ? Math.max(0, income - moneyCents(plan.actual_at_creation.income_eur)) : 0
  const expectedIncome = plan ? Math.max(0, moneyCents(plan.future_income_eur) - additionalIncome) : 0
  const futureSpending = rows.reduce((sum, row) => sum + Math.max(0, row.remaining || 0, row.protectedRemaining), 0)
  const projectedSavings = income + refunds + expectedIncome - spent - futureSpending
  const forecastSpending = rows.reduce((sum, row) => sum + row.forecast, 0)
  const forecastSavings = income + refunds + expectedIncome - forecastSpending
  const cushion = plan ? moneyCents(plan.cushion_eur) : 0
  return { rows, income, spent, refunds, expectedIncome, futureSpending, projectedSavings, forecastSavings,
    cushion, fundingGap: Math.max(0, cushion - projectedSavings) }
}

export function planChanges(previous, current, mode) {
  if (!previous || !current || previous.month !== current.month) return []
  const before = new Map(previous.approaches[mode].categories.map((row) => [row.category, moneyCents(row.limit_eur)]))
  const after = new Map(current.approaches[mode].categories.map((row) => [row.category, row]))
  return [...new Set([...before.keys(), ...after.keys()])].map((category) => {
    const row = after.get(category)
    return { category, change: (row ? moneyCents(row.limit_eur) : 0) - (before.get(category) || 0), reason: row?.reason || 'No further allowance in the updated plan.' }
  }).filter((row) => row.change).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}
