import { beforeEach, expect, it, vi } from 'vitest'
import { authFetch } from '../config/api.js'
import { createBudgetPlan } from './finance.js'
import { budgetResult } from '../test/budgetFixture.js'

vi.mock('../config/api.js', () => ({ authFetch: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

function stream(events, cuts = []) {
  const encoded = new TextEncoder().encode(events)
  const points = [0, ...cuts, encoded.length]
  return { ok: true, status: 200, headers: { get: () => 'application/x-ndjson' }, body: new ReadableStream({
    start(controller) { for (let i = 1; i < points.length; i++) controller.enqueue(encoded.slice(points[i - 1], points[i])); controller.close() },
  }) }
}

it('reads fragmented UTF-8 events and reports stages before returning the plan', async () => {
  const data = { status: 'success', ...budgetResult() }
  data.plan.approaches.balanced.analysis = 'Leave €50 for groceries.'
  const events = `${JSON.stringify({ event: 'progress', stage: 'checking' })}\n${JSON.stringify({ event: 'progress', stage: 'reviewing' })}\n${JSON.stringify({ event: 'result', data })}\n`
  const euro = new TextEncoder().encode(events).indexOf(0xe2)
  authFetch.mockResolvedValue(stream(events, [9, euro + 1, euro + 2]))
  const progress = vi.fn()
  const result = await createBudgetPlan(undefined, progress)
  expect(progress.mock.calls).toEqual([['checking'], ['reviewing']])
  expect(result).toEqual(data)
  expect(authFetch.mock.calls[0][1].headers.Accept).toBe('application/x-ndjson')
})

it('keeps compatibility with the previous JSON endpoint', async () => {
  const data = { status: 'success', ...budgetResult() }
  authFetch.mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => data })
  expect(await createBudgetPlan()).toEqual(data)
})

it('propagates streamed validation errors with their reason and status', async () => {
  authFetch.mockResolvedValue(stream(JSON.stringify({ event: 'error', http_status: 422,
    data: { error: 'budget_invalid_proposal', message: 'Previous plan retained.', validation_reason: 'A bill was not covered.' } }) + '\n'))
  await expect(createBudgetPlan()).rejects.toMatchObject({ status: 422, code: 'budget_invalid_proposal', validationReason: 'A bill was not covered.' })
})

it('rejects interrupted or malformed streams instead of accepting a missing plan', async () => {
  for (const events of ['{"event":"progress","stage":"checking"}\n', '{broken-json}\n']) {
    authFetch.mockResolvedValue(stream(events))
    await expect(createBudgetPlan()).rejects.toMatchObject({ name: 'ApiError', status: 502 })
  }
})
