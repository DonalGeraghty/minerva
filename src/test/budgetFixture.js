export const budgetMeta = { snapshot_id: 'budget-snapshot', rule_set_version: 1, fetched_at: '2026-11-25T10:00:00Z', generated_at: '2026-11-25T11:00:00Z', provider: 'openai', model: 'example', stale: false, source: 'google_sheets' }
export const budgetContext = {
  month: '2026-11', today: '2026-11-25', history_start: '2026-05', days_remaining: 5,
  latest_transaction_date: '2026-11-24', missing_months: [], provisional: false, warnings: [],
  actual: { income_eur: '4000.00', spent_eur: '1200.00', refunds_eur: '20.00', net_eur: '2820.00' },
  cash_snapshot: { available: false },
  current_categories: [
    { category: 'Groceries', spent_eur: '200.00', refunds_eur: '20.00' },
    { category: 'Housing', spent_eur: '1000.00', refunds_eur: '0.00' },
  ],
}
export function budgetResult() {
  const assumption = { id: 'salary', kind: 'income', label: 'Bonus', category: 'Income', amount_eur: '1000.00', due_date: '2026-11-28', status: 'expected', confidence: 'medium', evidence: 'Recent bonus evidence', basis: 'history' }
  const bill = { ...assumption, id: 'bill', kind: 'bill', label: 'Expected housing bill', category: 'Housing', amount_eur: '200.00' }
  return { meta: { ...budgetMeta }, context: structuredClone(budgetContext), plan: {
    plan_id: 'plan-one', month: '2026-11', created_date: '2026-11-25', explanation: 'Protect the housing bill, then adjust flexible spending.',
    actual_at_creation: { ...budgetContext.actual }, future_income_eur: '1000.00', cushion_eur: '500.00',
    assumptions: [assumption, bill], approaches: Object.fromEntries(['save_more', 'balanced', 'breathing_room'].map((id, index) => [id, {
      categories: [
        { category: 'Groceries', fixed: false, spent_at_creation_eur: '200.00', reserved_bills_eur: '0.00', limit_eur: `${400 + index * 100}.00`, forecast_eur: '650.00', confidence: 'medium', reason: 'A realistic allowance for the remaining days.' },
        { category: 'Housing', fixed: true, spent_at_creation_eur: '1000.00', reserved_bills_eur: '200.00', limit_eur: '1200.00', forecast_eur: '1200.00', confidence: 'high', reason: 'The bill still needs to be paid.' },
      ],
    }])) },
  }
}
