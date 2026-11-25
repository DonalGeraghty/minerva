import { expect, it } from 'vitest'
import { budgetContext, budgetResult } from '../test/budgetFixture.js'
import { budgetView } from './budget.js'

it('reconciles the headline in cents across all three approaches', () => {
  const plan = budgetResult().plan
  const view = budgetView(budgetContext, plan)
  expect(view.projectedSavings).toBe(332000)
  expect(view.rows.find((row) => row.category === 'Groceries').remaining).toBe(30000)
  expect(budgetView(budgetContext, plan, 'save_more').projectedSavings).toBeGreaterThan(view.projectedSavings)
  expect(budgetView(budgetContext, plan, 'breathing_room').projectedSavings).toBeLessThan(view.projectedSavings)
})

it('updates actuals without moving limits or counting received forecast income twice', () => {
  const context = structuredClone(budgetContext)
  context.actual.income_eur = '5000.00'
  context.actual.spent_eur = '1250.00'
  context.current_categories[0].spent_eur = '250.00'
  const view = budgetView(context, budgetResult().plan)
  expect(view.expectedIncome).toBe(0)
  expect(view.projectedSavings).toBe(332000)
  expect(view.rows.find((row) => row.category === 'Groceries').limit).toBe(50000)
  expect(view.rows.find((row) => row.category === 'Groceries').remaining).toBe(25000)
})

it('protects unpaid bills as spending grows and flags new category overspending', () => {
  const updated = structuredClone(budgetContext)
  updated.current_categories[1].spent_eur = '1250.00'
  updated.actual.spent_eur = '1450.00'
  updated.current_categories.push({ category: 'Travel', spent_eur: '10.00', refunds_eur: '0' })
  const view = budgetView(updated, budgetResult().plan)
  expect(view.rows.find((row) => row.category === 'Housing').protectedRemaining).toBe(20000)
  expect(view.rows.find((row) => row.category === 'Housing').remaining).toBe(-5000)
  expect(view.futureSpending).toBe(50000)
  expect(view.rows.find((row) => row.category === 'Travel').remaining).toBe(-1000)
})
