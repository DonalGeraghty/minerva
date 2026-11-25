import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import ChatMarkdown from './ChatMarkdown.jsx'

afterEach(cleanup)

it('does not render raw HTML, remote images or unsafe links', () => {
  const { container } = render(<ChatMarkdown>{'<script>alert(1)</script>\n\n<img src="https://example.com/track" onerror="alert(1)">\n\n![tracking](https://example.com/track)\n\n[unsafe](javascript:alert%281%29)\n\n[Source](https://example.com/report)'}</ChatMarkdown>)
  expect(container.querySelector('script, img')).toBeNull()
  expect(screen.getByText('unsafe').closest('a')).toBeNull()
  expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://example.com/report')
  expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('rel', 'noopener noreferrer')
})
