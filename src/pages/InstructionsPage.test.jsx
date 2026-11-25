import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import InstructionsPage from './InstructionsPage.jsx'
import { LLM_RULE_BRIEF, RULE_CSV_HEADER } from '../lib/ruleGuide.js'

it('explains setup and provides a copyable, review-first LLM contract', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><InstructionsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Connect your Sheet.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Connect your AI.' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'For LLMs' }))
  expect(screen.getByLabelText('Minerva instructions for an LLM')).toHaveValue(LLM_RULE_BRIEF)
  await user.click(screen.getByRole('button', { name: 'Copy LLM brief' }))
  expect(await navigator.clipboard.readText()).toContain(RULE_CSV_HEADER)
  expect(screen.getByRole('status')).toHaveTextContent('LLM brief copied')
  expect(LLM_RULE_BRIEF).toContain('Default new suggestions to review')
  expect(LLM_RULE_BRIEF).toContain('Ask is read-only')
})
