export const DEMO_EMAIL = 'demo@minerva.local'
export const DEMO_PASSWORD = 'minerva-demo'
export const DEMO_TOKEN = 'minerva-demo-session'
export const DEMO_USER = { email: DEMO_EMAIL, accountId: 'minerva-demo-account', isDemo: true }

const STORAGE_KEY = 'minerva_demo_cards_v1'

function now() { return new Date() }

function isoAfter(days) {
  return new Date(now().getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

function seedCards() {
  return [
    {
      id: 'demo-hindi-kal', front: 'What does कल (kal) mean in Hindi?',
      back: 'It can mean either yesterday or tomorrow; context makes the meaning clear.',
      tags: ['hindi'], due_at: isoAfter(-1), review_count: 0, interval_days: 0,
      created_at: isoAfter(-7), updated_at: isoAfter(-7),
    },
    {
      id: 'demo-computing-closure', front: 'What is a JavaScript closure?',
      back: 'A function plus access to its lexical environment, even after its outer function returns.',
      tags: ['computing'], due_at: isoAfter(-1), review_count: 2, interval_days: 2,
      created_at: isoAfter(-10), updated_at: isoAfter(-2),
    },
    {
      id: 'demo-history-1066', front: 'Why is 1066 significant in English history?',
      back: 'It is the year of the Norman Conquest, when William of Normandy defeated Harold II at Hastings.',
      tags: ['history'], due_at: isoAfter(2), review_count: 1, interval_days: 4,
      created_at: isoAfter(-4), updated_at: isoAfter(-1),
    },
  ]
}

function readCards() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* A fresh demo is still useful when browser storage is unavailable. */ }
  const cards = seedCards()
  writeCards(cards)
  return cards
}

function writeCards(cards) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(cards)) } catch { /* Local demo state is optional. */ }
}

function normalizeTags(tags = []) {
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
}

function copy(card) { return { ...card, tags: [...(card.tags || [])] } }

export function listDemoCards() {
  return readCards().map(copy).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
}

export function listDemoDueCards({ tag = '' } = {}) {
  const current = now()
  return listDemoCards().filter((card) => new Date(card.due_at) <= current && (!tag || card.tags.includes(tag)))
}

export function createDemoFlashcard(card) {
  const timestamp = now().toISOString()
  const created = {
    id: `demo-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    front: card.front.trim(), back: card.back.trim(), tags: normalizeTags(card.tags),
    source_message: card.sourceMessage || null, due_at: timestamp, review_count: 0, interval_days: 0,
    created_at: timestamp, updated_at: timestamp,
  }
  writeCards([...readCards(), created])
  return copy(created)
}

export function updateDemoFlashcard(cardId, card) {
  let updated = null
  const cards = readCards().map((item) => {
    if (item.id !== cardId) return item
    updated = { ...item, front: card.front.trim(), back: card.back.trim(), tags: normalizeTags(card.tags), updated_at: now().toISOString() }
    return updated
  })
  if (!updated) throw new Error('Flashcard not found')
  writeCards(cards)
  return copy(updated)
}

export function deleteDemoFlashcard(cardId) {
  writeCards(readCards().filter((card) => card.id !== cardId))
}

export function reviewDemoFlashcard(cardId, rating) {
  const factors = { again: 0, hard: 1, good: 2, easy: 4 }
  if (!(rating in factors)) throw new Error('Choose a valid recall rating')
  let updated = null
  const cards = readCards().map((item) => {
    if (item.id !== cardId) return item
    const interval = rating === 'again' ? 0 : Math.max(factors[rating], Math.round((item.interval_days || 1) * factors[rating]))
    const dueAt = rating === 'again'
      ? new Date(now().getTime() + 10 * 60 * 1000).toISOString()
      : isoAfter(interval)
    updated = { ...item, interval_days: interval, due_at: dueAt, review_count: (item.review_count || 0) + 1, updated_at: now().toISOString() }
    return updated
  })
  if (!updated) throw new Error('Flashcard not found')
  writeCards(cards)
  return copy(updated)
}

export function createDemoResponse(message) {
  const text = message.trim()
  const tags = ['hindi', 'computing', 'history'].filter((tag) => text.toLowerCase().includes(tag))
  const asksForCard = /\b(add|create|make|turn)\b.*\b(flashcard|card)\b|\b(flashcard|card)\b.*\b(add|create|make)\b/i.test(text)
  if (!asksForCard) {
    return { kind: 'answer', reply: 'Demo mode is local and does not call an LLM. Ask me to add a flashcard, then edit the draft to explore the full workflow.' }
  }
  return {
    kind: 'card_draft',
    reply: 'I prepared a local demo card. Refine it before adding it to the demo rotation.',
    card: {
      front: `What would you like to remember about: ${text.replace(/\s+/g, ' ').slice(0, 180)}?`,
      back: 'This is a local demo card. Edit this answer before adding it to your demo rotation.',
      suggested_tags: tags.length ? tags : ['demo'],
    },
  }
}

export function resetDemoCards() {
  writeCards(seedCards())
}
