import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GalleryPage from './GalleryPage.jsx'
import { listFlashcards } from '../services/flashcards.js'
import { listDemoCards } from '../services/demoStore.js'

const { auth, logout } = vi.hoisted(() => ({ auth: { user: { accountId: 'gallery-account' } }, logout: vi.fn() }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user, logout }) }))
vi.mock('../services/flashcards.js', () => ({ listFlashcards: vi.fn() }))
vi.mock('../services/demoStore.js', () => ({ listDemoCards: vi.fn() }))
const cards = [{ id: 'closure', front: 'What is a closure?', back: 'A function with its lexical environment.', tags: ['computing'] },
  { id: 'kal', front: 'What does kal mean?', back: 'Yesterday or tomorrow.', tags: ['hindi'] }]
const pointer = (type, id, x, touch = false) => {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 250, button: 0 })
  Object.defineProperties(event, { pointerId: { value: id }, isPrimary: { value: id === 1 }, pointerType: { value: touch ? 'touch' : 'mouse' } })
  return event
}

describe('Flashcard wall', () => {
  beforeEach(() => {
    vi.clearAllMocks(); auth.user = { accountId: 'gallery-account' }
    listFlashcards.mockResolvedValue(cards); listDemoCards.mockReturnValue(cards)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('centres and brings a distant card forward when selected', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    const field = await screen.findByRole('region', { name: 'Infinite flashcard gallery' })
    const far = [...field.querySelectorAll('.gallery-plane')].find((card) => Number(card.dataset.planeScale) < 0.3 && card.tabIndex === 0)
    expect(far).toBeDefined()
    await user.click(far)
    expect(far).toHaveAttribute('data-focused', 'true')
    await waitFor(() => expect(Number(far.dataset.planeScale)).toBeGreaterThan(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('centres on first click and flips in place on a second click, without a modal or review writes', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    await user.click((await screen.findAllByRole('button', { name: 'Focus flashcard: What is a closure?' }))[0])
    const focused = screen.getByRole('button', { name: 'Flip flashcard: What is a closure?' })
    expect(focused).toHaveAttribute('data-focused', 'true')
    expect(focused).toHaveAttribute('data-side', 'front')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(focused)
    expect(focused).toHaveAttribute('data-side', 'back')
    expect(focused.querySelector('.gallery-card-back')).toHaveAttribute('aria-hidden', 'false')
    expect(focused.querySelector('.gallery-card-back')).toHaveTextContent(cards[0].back)
    await waitFor(() => {
      const x = Number(focused.style.transform.match(/calc\(-50% \+ ([^p]+)px\)/)[1])
      expect(Math.abs(x)).toBeLessThan(0.01)
    })
    await user.click(focused)
    expect(focused).toHaveAttribute('data-side', 'front')
    expect(listFlashcards).toHaveBeenCalledTimes(1)
  })

  it('shows a genuinely blank reverse face when an answer is absent', async () => {
    listFlashcards.mockResolvedValue([{ id: 'blank', front: 'Unanswered prompt', tags: [] }])
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    await user.click((await screen.findAllByRole('button', { name: 'Focus flashcard: Unanswered prompt' }))[0])
    const focused = screen.getByRole('button', { name: 'Flip flashcard: Unanswered prompt' })
    await user.click(focused)
    expect(focused.querySelector('.gallery-card-back').textContent).toBe('')
    expect(focused.querySelector('.gallery-card-front')).toHaveAttribute('aria-hidden', 'true')
  })

  it('filters the wall and retains the accessible list with full previews', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    await screen.findByRole('region', { name: 'Infinite flashcard gallery' })
    await user.click(screen.getByRole('tab', { name: 'Card list' }))
    await user.selectOptions(screen.getByLabelText('Tag'), 'hindi')
    expect(screen.queryByText(cards[0].front)).not.toBeInTheDocument()
    await user.click(screen.getByText(cards[1].front))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reveal answer' }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: cards[1].back })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close flashcard' }))
    await user.type(screen.getByLabelText('Search flashcards'), 'lexical')
    expect(screen.getByText('No cards match.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText(cards[0].front)).toBeInTheDocument()
  })

  it('offers retry after a failed read and expires invalid sessions', async () => {
    listFlashcards.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(cards)
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('region', { name: 'Infinite flashcard gallery' })).toBeInTheDocument()
    cleanup(); listFlashcards.mockRejectedValueOnce(Object.assign(new Error('Expired'), { status: 401 }))
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  })

  it('uses the isolated demo and defaults to a list for reduced motion', async () => {
    auth.user = { accountId: 'demo-account', isDemo: true }
    window.matchMedia.mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    expect(await screen.findByText(cards[0].front)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Card list' })).toHaveAttribute('aria-selected', 'true')
    expect(listFlashcards).not.toHaveBeenCalled()
  })

  it('keeps wheel travel unlimited and rendering bounded, with reset and keyboard controls', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    const field = await screen.findByRole('region', { name: 'Infinite flashcard gallery' })
    for (let i = 0; i < 200; i++) fireEvent.wheel(field, { deltaY: -100, clientX: 500, clientY: 300 })
    await waitFor(() => expect(Number(field.dataset.cameraDepth)).toBe(36000))
    fireEvent.wheel(field, { deltaY: 100, clientX: 500, clientY: 300 })
    await waitFor(() => expect(Number(field.dataset.cameraDepth)).toBe(35820))
    expect(field.querySelectorAll('.gallery-plane').length).toBeLessThanOrEqual(161)
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Reset view' }))
    await waitFor(() => expect(Number(field.dataset.cameraDepth)).toBe(0))
    fireEvent.keyDown(field, { key: '+' })
    await waitFor(() => expect(Number(field.dataset.cameraDepth)).toBe(240))
  })

  it('drags the wall without accidentally focusing or flipping a card', async () => {
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    const field = await screen.findByRole('region', { name: 'Infinite flashcard gallery' })
    const before = field.querySelector('.gallery-plane').style.transform
    fireEvent(field.querySelector('.gallery-plane'), pointer('pointerdown', 1, 100))
    fireEvent(field, pointer('pointermove', 1, 180)); fireEvent(field, pointer('pointerup', 1, 180))
    await waitFor(() => expect(field.querySelector('.gallery-plane').style.transform).not.toBe(before))
    fireEvent.click(field.querySelector('.gallery-plane'), { detail: 1 })
    expect(field.querySelector('[data-focused]')).toBeNull()
    const next = field.querySelector('.gallery-plane')
    fireEvent(next, pointer('pointerdown', 1, 180)); fireEvent(next, pointer('pointerup', 1, 180))
    fireEvent.click(next, { detail: 1 })
    expect(field.querySelector('[data-focused]')).not.toBeNull()
  })

  it('expands and restores scrolling and supports pinch travel with safe cancellation', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    const field = await screen.findByRole('region', { name: 'Infinite flashcard gallery' })
    await user.click(screen.getByRole('button', { name: 'Expand gallery' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.body.style.overflow).not.toBe('hidden')
    fireEvent(field, pointer('pointerdown', 1, 400, true)); fireEvent(field, pointer('pointerdown', 2, 600, true))
    fireEvent(field, pointer('pointermove', 2, 700, true))
    await waitFor(() => expect(Number(field.dataset.cameraDepth)).toBeGreaterThan(400))
    fireEvent.blur(window)
    fireEvent(field, pointer('pointerup', 2, 700, true)); fireEvent(field, pointer('pointerup', 1, 400, true))
    fireEvent.click(field.querySelector('.gallery-plane'), { detail: 1 })
    expect(field.querySelector('[data-focused]')).toBeNull()
  })
})
