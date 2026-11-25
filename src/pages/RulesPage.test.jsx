import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RulesPage from './RulesPage.jsx'
import * as rulesApi from '../services/financeRules.js'

vi.mock('../services/financeRules.js', async (original) => {
  const module = await original()
  return {
    ...module,
    listFinanceRules: vi.fn(), updateFinanceRule: vi.fn(),
    deleteFinanceRule: vi.fn(), previewRulesImport: vi.fn(), commitRulesImport: vi.fn(),
    listRuleHistory: vi.fn(), restoreRuleVersion: vi.fn(),
  }
})

const RULE = {
  rule_id: 'A01', scope: 'janus', name: 'Exclude flagged rows', type: 'accounting', field: 'include_provisional_totals',
  operator: 'equals', value: 'NO', action: 'exclude', action_value: 'all_budget_totals', priority: 1000,
  status: 'active', source_section: '4.1', description: 'Never override', revision: 1,
}

function listResponse(rules = [RULE], version = 1) {
  return { status: 'success', rules, rule_set_version: version }
}

async function renderPage() {
  return render(<MemoryRouter><RulesPage /></MemoryRouter>)
}

describe('Rules page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // jsdom does not implement the native dialog top layer.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    rulesApi.listFinanceRules.mockResolvedValue(listResponse())
  })
  afterEach(() => cleanup())

  it('edits a rule with its current revision and deletes after confirmation', async () => {
    const user = userEvent.setup()
    rulesApi.updateFinanceRule.mockResolvedValue({ status: 'success', rule: { ...RULE, name: 'Renamed' }, rule_set_version: 2 })
    rulesApi.deleteFinanceRule.mockResolvedValue({ status: 'success', deleted: true, rule_set_version: 3 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderPage()
    const row = (await screen.findByText('A01')).closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save rule' }))
    await waitFor(() => expect(rulesApi.updateFinanceRule).toHaveBeenCalledWith('A01', expect.objectContaining({ revision: 1, name: 'Renamed' })))
    await user.click(within((await screen.findByText('A01')).closest('tr')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(rulesApi.deleteFinanceRule).toHaveBeenCalledWith('A01', 1))
  })

  it('previews a CSV upload and commits it explicitly', async () => {
    const user = userEvent.setup()
    rulesApi.previewRulesImport.mockResolvedValue({
      valid: true, mode: 'preview', would_be_version: 2,
      changes: [{ rule_id: 'A01', change: 'update', status: 'active' }], held: [], conflicts: [],
    })
    rulesApi.commitRulesImport.mockResolvedValue({ committed: true, rule_set_version: 2, changes: [], held: [], conflicts: [] })
    await renderPage()
    await screen.findByText('A01')
    const file = new File(['rule_id,scope\r\nA01,janus\r\n'], 'financial_rules.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('Import rules CSV file'), file)
    expect(await screen.findByText(/1 to update/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Commit import' }))
    await waitFor(() => expect(rulesApi.commitRulesImport).toHaveBeenCalledWith(expect.stringContaining('A01')))
    await waitFor(() => expect(rulesApi.listFinanceRules).toHaveBeenCalledTimes(2))
  })

  it('lists history and restores a version after confirmation', async () => {
    const user = userEvent.setup()
    rulesApi.listRuleHistory.mockResolvedValue({ history: [{ version: 2, created_at: '2026-11-24T10:00:00+00:00', summary: 'Updated rule A01', changed_rule_ids: ['A01'], rule_count: 1 }], rule_set_version: 2 })
    rulesApi.restoreRuleVersion.mockResolvedValue({ rule_set_version: 3, restored_from: 2, changed_rule_ids: ['A01'] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderPage()
    await screen.findByText('A01')
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(await screen.findByText('Updated rule A01')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(rulesApi.restoreRuleVersion).toHaveBeenCalledWith(2))
  })

})
