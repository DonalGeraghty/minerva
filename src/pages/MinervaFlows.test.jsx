import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskPage from './AskPage.jsx'
import FlashcardsPage from './FlashcardsPage.jsx'
import { createFlashcard, deleteFlashcard, listDueFlashcards, listFlashcards, reviewFlashcard } from '../services/flashcards.js'
import { askMinerva } from '../services/minerva.js'

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }))

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ logout: logoutMock }) }))
vi.mock('../services/minerva.js', () => ({ askMinerva: vi.fn() }))
vi.mock('../services/flashcards.js', () => ({
  createFlashcard: vi.fn(),
  deleteFlashcard: vi.fn(),
  listDueFlashcards: vi.fn(),
  listFlashcards: vi.fn(),
  reviewFlashcard: vi.fn(),
  updateFlashcard: vi.fn(),
}))

const sampleCard = {
  id: 'card-1',
  front: 'What does कल mean?',
  back: 'Yesterday or tomorrow, depending on context.',
  tags: ['hindi'],
  due_at: '2026-08-19T12:00:00+00:00',
  review_count: 0,
}

describe('Minerva creation and review flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listFlashcards.mockResolvedValue([sampleCard])
    listDueFlashcards.mockResolvedValue([sampleCard])
  })

  afterEach(() => cleanup())

  it('keeps an AI-created flashcard as a reviewable draft until confirmed', async () => {
    askMinerva.mockResolvedValue({
      kind: 'card_draft',
      reply: 'I prepared a Hindi card.',
      cards: [{
        front: sampleCard.front,
        back: sampleCard.back,
        suggested_tags: ['hindi'],
      }],
    })
    createFlashcard.mockResolvedValue(sampleCard)
    const user = userEvent.setup()
    render(<MemoryRouter><AskPage /></MemoryRouter>)

    await user.type(screen.getByLabelText('What would you like to learn?'), 'Add a card for kal')
    await user.click(screen.getByRole('button', { name: /ask minerva/i }))
    expect(await screen.findByDisplayValue(sampleCard.front)).toBeInTheDocument()
    expect(createFlashcard).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /add to rotation/i }))
    await waitFor(() => expect(createFlashcard).toHaveBeenCalledWith(
      expect.objectContaining({
        front: sampleCard.front,
        back: sampleCard.back,
        tags: ['hindi'],
      }),
      expect.any(String),
    ))
    expect(await screen.findByText(/saved\. this card is now due/i)).toBeInTheDocument()
  })

  it('reviews and saves multiple generated cards independently', async () => {
    const secondCard = { ...sampleCard, id: 'card-2', front: 'What part of speech is कल?', back: 'Adverb.' }
    askMinerva.mockResolvedValue({
      kind: 'card_draft',
      reply: 'I prepared two Hindi cards.',
      cards: [
        { front: sampleCard.front, back: sampleCard.back, suggested_tags: ['hindi'] },
        { front: secondCard.front, back: secondCard.back, suggested_tags: ['hindi', 'grammar'] },
      ],
    })
    createFlashcard.mockResolvedValueOnce(sampleCard).mockResolvedValueOnce(secondCard)
    const user = userEvent.setup()
    render(<MemoryRouter><AskPage /></MemoryRouter>)

    await user.type(screen.getByLabelText('What would you like to learn?'), 'Make two cards about kal')
    await user.click(screen.getByRole('button', { name: /ask minerva/i }))

    expect(await screen.findByText('Card 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()
    const saveButtons = screen.getAllByRole('button', { name: /add to rotation/i })
    await user.click(saveButtons[0])
    await user.click(saveButtons[1])

    await waitFor(() => expect(createFlashcard).toHaveBeenCalledTimes(2))
    expect(createFlashcard).toHaveBeenNthCalledWith(2, expect.objectContaining({ front: secondCard.front, back: secondCard.back, tags: ['hindi', 'grammar'] }), expect.any(String))
  })

  it('reveals a due card and records a recall rating', async () => {
    reviewFlashcard.mockResolvedValue({ ...sampleCard, review_count: 1, interval_days: 1 })
    const user = userEvent.setup()
    render(<MemoryRouter><FlashcardsPage /></MemoryRouter>)

    expect(await screen.findByText(sampleCard.front)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText(sampleCard.back)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /good/i }))
    await waitFor(() => expect(reviewFlashcard).toHaveBeenCalledWith('card-1', 'good', expect.any(String)))
    expect(await screen.findByText(/you are caught up/i)).toBeInTheDocument()
  })

  it('deletes a library card immediately without a confirmation popup', async () => {
    deleteFlashcard.mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    render(<MemoryRouter><FlashcardsPage /></MemoryRouter>)

    await user.click(await screen.findByRole('tab', { name: /all cards/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteFlashcard).toHaveBeenCalledWith('card-1'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(sampleCard.front)).not.toBeInTheDocument()
    confirmSpy.mockRestore()
  })
})
