import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RulesPage from './RulesPage.jsx'
import * as rulesApi from '../services/financeRules.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one', email: 'owner@example.com' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/financeRules.js', async (original) => {
  const module = await original()
  return {
    ...module,
    listFinanceRules: vi.fn(), createFinanceRule: vi.fn(), updateFinanceRule: vi.fn(),
    deleteFinanceRule: vi.fn(), previewRulesImport: vi.fn(), commitRulesImport: vi.fn(),
    exportRulesCsv: vi.fn(), exportRulesJson: vi.fn(), listRuleHistory: vi.fn(), restoreRuleVersion: vi.fn(),
    downloadText: vi.fn(),
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
    rulesApi.listFinanceRules.mockResolvedValue(listResponse())
  })
  afterEach(() => cleanup())

  it('lists rules with their condition, action and version', async () => {
    await renderPage()
    expect(await screen.findByText('A01')).toBeInTheDocument()
    expect(screen.getByText(/include_provisional_totals equals NO/)).toBeInTheDocument()
    expect(screen.getByText(/exclude: all_budget_totals/)).toBeInTheDocument()
    expect(screen.getByText('active', { selector: '.rules-badge' })).toBeInTheDocument()
    expect(screen.getByText(/rule set v1/i)).toBeInTheDocument()
    expect(rulesApi.listFinanceRules).toHaveBeenCalledWith(expect.objectContaining({ includeDeleted: true }))
  })

  it('creates a rule through the add form', async () => {
    const user = userEvent.setup()
    rulesApi.createFinanceRule.mockResolvedValue({ status: 'success', rule: RULE, rule_set_version: 2 })
    await renderPage()
    await screen.findByText('A01')
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    await user.type(screen.getByLabelText('Rule ID'), 'T09')
    await user.type(screen.getByLabelText('Name'), 'Ordinary spending')
    await user.type(screen.getByLabelText('Value'), 'ordinary_expense')
    await user.type(screen.getByLabelText('Action value'), 'Expense')
    await user.click(screen.getByRole('button', { name: 'Save rule' }))
    await waitFor(() => expect(rulesApi.createFinanceRule).toHaveBeenCalledWith(expect.objectContaining({
      rule_id: 'T09', name: 'Ordinary spending', value: 'ordinary_expense', action_value: 'Expense', priority: 100,
    })))
    await waitFor(() => expect(rulesApi.listFinanceRules).toHaveBeenCalledTimes(2))
  })

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

  it('toggles a rule between active and disabled', async () => {
    const user = userEvent.setup()
    rulesApi.updateFinanceRule.mockResolvedValue({ status: 'success', rule: { ...RULE, status: 'disabled' }, rule_set_version: 2 })
    await renderPage()
    const row = (await screen.findByText('A01')).closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Disable' }))
    await waitFor(() => expect(rulesApi.updateFinanceRule).toHaveBeenCalledWith('A01', { revision: 1, status: 'disabled' }))
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

  it('shows backend errors such as missing finance entitlement', async () => {
    rulesApi.listFinanceRules.mockRejectedValue(new Error('Finance access is not enabled for this account.'))
    await renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Finance access is not enabled for this account.')
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
