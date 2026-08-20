import { API_ENDPOINTS } from '../config/api.js'
import { apiRequest } from './request.js'

function cardPath(cardId) {
  const id = String(cardId || '').trim()
  if (!id) throw new Error('Flashcard ID is required')
  return `${API_ENDPOINTS.FLASHCARDS}/${encodeURIComponent(id)}`
}

export async function createFlashcard(card, clientRequestId) {
  const data = await apiRequest(API_ENDPOINTS.FLASHCARDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      front: card.front,
      back: card.back,
      tags: card.tags,
      source_message: card.sourceMessage || null,
      client_request_id: clientRequestId,
    }),
  })
  return data.card
}

export async function listFlashcards({ tag = '', limit = 500 } = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (tag) search.set('tag', tag)
  const data = await apiRequest(`${API_ENDPOINTS.FLASHCARDS}?${search}`, { method: 'GET' })
  return data.cards || []
}

export async function listDueFlashcards({ tag = '', limit = 100 } = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (tag) search.set('tag', tag)
  const data = await apiRequest(`${API_ENDPOINTS.FLASHCARDS_DUE}?${search}`, { method: 'GET' })
  return data.cards || []
}

export async function updateFlashcard(cardId, card) {
  const data = await apiRequest(cardPath(cardId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front: card.front, back: card.back, tags: card.tags }),
  })
  return data.card
}

export async function deleteFlashcard(cardId) {
  await apiRequest(cardPath(cardId), { method: 'DELETE' })
}

export async function reviewFlashcard(cardId, rating, clientRequestId) {
  const data = await apiRequest(`${cardPath(cardId)}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, client_request_id: clientRequestId }),
  })
  return data.card
}
