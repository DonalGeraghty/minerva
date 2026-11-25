import { expect, it } from 'vitest'
import { budgetContext, budgetResult } from '../test/budgetFixture.js'
import { budgetView, centsText, planChanges } from './budget.js'

it('reconciles savings, refunds, future income, weekly amounts and all three approaches in cents', () => {
  const plan = budgetResult().plan
  const view = budgetView(budgetContext, plan)
  expect(view.projectedSavings).toBe(332000)
  expect(view.forecastSavings).toBe(317000)
  expect(view.rows.find((row) => row.category === 'Groceries').remaining).toBe(30000)
  expect(view.rows.find((row) => row.category === 'Groceries').weekly).toBe(30000)
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

it('protects unpaid bills even when a manual target is lower and flags overspending', () => {
  const view = budgetView(budgetContext, budgetResult().plan, 'balanced', { Housing: '1000.00', Groceries: '100.00' })
  expect(view.rows.find((row) => row.category === 'Housing').protectedRemaining).toBe(20000)
  expect(view.futureSpending).toBe(20000)
  expect(view.rows.find((row) => row.category === 'Groceries').remaining).toBe(-10000)
  expect(() => budgetView(budgetContext, budgetResult().plan, 'balanced', { Housing: 'NaN' })).toThrow()
  const updated = structuredClone(budgetContext)
  updated.current_categories[1].spent_eur = '1100.00'
  updated.actual.spent_eur = '1300.00'
  expect(budgetView(updated, budgetResult().plan).rows.find((row) => row.category === 'Housing').protectedRemaining).toBe(20000)
})

it('explains changes against the preceding plan including removed categories', () => {
  const before = budgetResult().plan
  const after = structuredClone(before)
  after.approaches.balanced.categories[0].limit_eur = '450.00'
  expect(planChanges(before, after, 'balanced')[0]).toMatchObject({ category: 'Groceries', change: -5000 })
  expect(centsText(-101)).toBe('-1.01')
})
