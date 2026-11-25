import { moneyCents } from './finance.js'

export const BUDGET_MODES = [
  { id: 'save_more', label: 'Save more' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'breathing_room', label: 'More flexibility' },
]

export function budgetView(context, plan, mode = 'balanced') {
  const actual = new Map(context.current_categories.map((row) => [row.category, row]))
  const proposed = new Map((plan?.approaches[mode]?.categories || []).map((row) => [row.category, row]))
  const rows = [...new Set([...actual.keys(), ...proposed.keys()])].map((category) => {
    const current = actual.get(category)
    const suggestion = proposed.get(category)
    const spent = moneyCents(current?.spent_eur || '0')
    const refunds = moneyCents(current?.refunds_eur || '0')
    const limit = plan ? moneyCents(suggestion?.limit_eur || '0') : null
    const remaining = limit == null ? null : limit - spent
    // Spending alone cannot prove a particular bill was paid. Keep its reserve
    // until reassessment incorporates the payment.
    const protectedRemaining = suggestion ? moneyCents(suggestion.reserved_bills_eur) : 0
    return { category, spent, refunds, limit, remaining, suggestion, protectedRemaining }
  }).filter((row) => row.suggestion || row.spent || row.refunds).sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category))
  const income = moneyCents(context.actual.income_eur)
  const spent = moneyCents(context.actual.spent_eur)
  const refunds = moneyCents(context.actual.refunds_eur)
  // Received forecast income must not count twice.
  const additionalIncome = plan ? Math.max(0, income - moneyCents(plan.actual_at_creation.income_eur)) : 0
  const expectedIncome = plan ? Math.max(0, moneyCents(plan.future_income_eur) - additionalIncome) : 0
  const futureSpending = rows.reduce((sum, row) => sum + Math.max(0, row.remaining || 0, row.protectedRemaining), 0)
  return { rows, expectedIncome, futureSpending, projectedSavings: income + refunds + expectedIncome - spent - futureSpending }
}
