import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDemoFlashcard,
  createDemoResponse,
  listDemoCards,
  listDemoDueCards,
  resetDemoCards,
  reviewDemoFlashcard,
} from './demoStore.js'

describe('local demo store', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoCards()
  })

  it('starts with seeded cards and moves a reviewed due card out of rotation', () => {
    const dueCard = listDemoDueCards()[0]
    expect(listDemoCards()).toHaveLength(3)
    const reviewed = reviewDemoFlashcard(dueCard.id, 'good')
    expect(new Date(reviewed.due_at).getTime()).toBeGreaterThan(Date.now())
    expect(listDemoDueCards().map((card) => card.id)).not.toContain(dueCard.id)
  })

  it('creates a locally editable card draft without an LLM call', () => {
    const response = createDemoResponse('Add a computing flashcard about closures')
    expect(response.kind).toBe('card_draft')
    expect(response.card.suggested_tags).toEqual(['computing'])
    const card = createDemoFlashcard({ front: 'What is a closure?', back: 'A function and lexical environment.', tags: ['Computing'] })
    expect(listDemoCards().find((item) => item.id === card.id)?.tags).toEqual(['computing'])
  })
})
