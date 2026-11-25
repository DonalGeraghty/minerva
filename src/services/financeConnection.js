import { apiRequest } from './request.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function getFinanceConnection(signal) {
  return apiRequest('/api/finance/connection', { signal })
}

export function saveFinanceConnection(workbookId, signal) {
  return apiRequest('/api/finance/connection', {
    method: 'PUT', headers: JSON_HEADERS, signal,
    body: JSON.stringify({ mode: 'service_account', workbook_id: workbookId }),
  })
}

export function deleteFinanceConnection(signal) {
  return apiRequest('/api/finance/connection', { method: 'DELETE', signal })
}
