import { API_ENDPOINTS } from '../config/api.js'
import { apiRequest } from './request.js'

function credentialPath(provider) {
  return `${API_ENDPOINTS.AI_CREDENTIALS}/${encodeURIComponent(provider)}`
}

export async function getAISettings() {
  const data = await apiRequest(API_ENDPOINTS.AI_SETTINGS, { method: 'GET' })
  return {
    selection: data.selection || { provider: '', model: '' },
    providers: data.providers || [],
  }
}

export async function saveAISelection(selection) {
  const data = await apiRequest(API_ENDPOINTS.AI_SETTINGS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
  })
  return data.selection
}

export async function saveAIProviderCredential(provider, apiKey) {
  return apiRequest(credentialPath(provider), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
}

export async function deleteAIProviderCredential(provider) {
  await apiRequest(credentialPath(provider), { method: 'DELETE' })
}
