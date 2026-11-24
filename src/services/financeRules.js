import { authFetch } from '../config/api.js'
import { apiRequest } from './request.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const RULE_SCOPES = ['janus', 'chatgpt_workflow']
export const RULE_TYPES = ['accounting', 'reporting', 'workflow', 'categorisation']
export const RULE_FIELDS = ['transaction_id', 'date', 'month', 'account', 'description', 'merchant', 'amount_eur', 'fee_eur', 'type', 'category', 'spending_class', 'review_status', 'include_provisional_totals', 'fund_purpose', 'recognition_status', 'asset_type', 'receipt_group_id', 'event_type', '*']
export const RULE_OPERATORS = ['always', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'gt', 'gte', 'lt', 'lte']
export const RULE_ACTIONS = ['classify', 'exclude', 'include', 'flag', 'set_category', 'allocate', 'reverse', 'allow', 'read_combined_only', 'use_eur', 'use_dublin', 'sum_eligible_signed', 'avoid_double_fee', 'monthly_net_waterfall', 'calendar_month_filters', 'label_provisional', 'assets_minus_liabilities', 'no_double_payroll', 'explicit_ratio', 'require_valid_budget', 'count_once', 'preserve_vocabulary', 'show_snapshot_age', 'same_financial_services', 'no_ledger_writes', 'exact_money', 'distinguish_returns', 'no_automatic_reclassification', 'preserve_raw', 'match_before_add', 'verify_group_total', 'five_exports', 'flag_gap', 'check_coverage', 'match_multiset', 'match_bank_id', 'match_economic_event', 'match_counterparties', 'reconcile_anchors', 'disclose_exceptions', 'readback', 'restrict_changes', 'backup_before_restructure', 'flag_known_limits', 'require_evidence']
export const RULE_STATUSES = ['active', 'review', 'disabled']

export function listFinanceRules({ includeDeleted = false, scope, status, signal } = {}) {
  const params = new URLSearchParams()
  if (includeDeleted) params.set('include_deleted', 'true')
  if (scope) params.set('scope', scope)
  if (status) params.set('status', status)
  const query = params.toString()
  return apiRequest(`/api/finance/rules${query ? `?${query}` : ''}`, { signal })
}

export function createFinanceRule(rule, signal) {
  return apiRequest('/api/finance/rules', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(rule), signal })
}

export function updateFinanceRule(ruleId, changes, signal) {
  return apiRequest(`/api/finance/rules/${encodeURIComponent(ruleId)}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(changes), signal })
}

export function deleteFinanceRule(ruleId, revision, signal) {
  return apiRequest(`/api/finance/rules/${encodeURIComponent(ruleId)}?revision=${revision}`, { method: 'DELETE', signal })
}

export function previewRulesImport(csv, signal) {
  return apiRequest('/api/finance/rules/import', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ csv, mode: 'preview' }), signal })
}

export function commitRulesImport(csv, signal) {
  return apiRequest('/api/finance/rules/import', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ csv, mode: 'commit' }), signal })
}

export async function exportRulesCsv(signal) {
  const response = await authFetch('/api/finance/rules/export?format=csv', { signal })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Could not export the rules CSV')
  }
  return response.text()
}

export function exportRulesJson(signal) {
  return apiRequest('/api/finance/rules/export?format=json', { signal })
}

export function testFinanceRules(rows, signal) {
  return apiRequest('/api/finance/rules/test', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ rows }), signal })
}

export function listRuleHistory(signal) {
  return apiRequest('/api/finance/rules/history', { signal })
}

export function restoreRuleVersion(version, signal) {
  return apiRequest(`/api/finance/rules/restore/${encodeURIComponent(version)}`, { method: 'POST', signal })
}

export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
