import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScavengerSidebar from '../ScavengerSidebar'

const ARTWORKS = [
  { objectid: 1, title: 'Banana', date_range: '1900' },
  { objectid: 2, title: 'Apple', date_range: '1950' },
  { objectid: 3, title: 'Cherry', date_range: '2000' },
]

describe('ScavengerSidebar', () => {
  it('renders progress with 0/3 found', () => {
    render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={ARTWORKS}
        foundIds={new Set()}
      />
    )
    expect(screen.getByText(/0 \/ 3 found/)).toBeInTheDocument()
    expect(screen.getByText(/0%/)).toBeInTheDocument()
  })

  it('renders progress with 2/3 found', () => {
    render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={ARTWORKS}
        foundIds={new Set([1, 3])}
      />
    )
    expect(screen.getByText(/2 \/ 3 found/)).toBeInTheDocument()
    expect(screen.getByText(/67%/)).toBeInTheDocument()
  })

  it('handles empty list (0% pct)', () => {
    render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={[]}
        foundIds={new Set()}
      />
    )
    expect(screen.getByText(/0 \/ 0 found/)).toBeInTheDocument()
    expect(screen.getByText(/0%/)).toBeInTheDocument()
  })

  it('sorts found before unfound, then alphabetically by title', () => {
    render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={ARTWORKS}
        foundIds={new Set([2])} // Apple is found
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Apple')
    // unfound, alphabetical: Banana, Cherry
    expect(items[1]).toHaveTextContent('Banana')
    expect(items[2]).toHaveTextContent('Cherry')
  })

  it('shows ✅ for found and ◻️ for unfound items', () => {
    render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={ARTWORKS}
        foundIds={new Set([1])}
      />
    )
    expect(screen.getAllByText('✅')).toHaveLength(1)
    expect(screen.getAllByText('◻️')).toHaveLength(2)
  })

  it('renders thumbnail when image_url present', () => {
    const { container } = render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={[
          { objectid: 1, title: 'X', image_url: 'https://iiif/thing' },
        ]}
        foundIds={new Set()}
      />
    )
    // alt="" makes the img presentational, so getByRole('img') won't find it.
    const img = container.querySelector('img')
    expect(img).toHaveAttribute(
      'src',
      'https://iiif/thing/full/120,/0/default.jpg'
    )
  })

  it('falls back to "Untitled" when no title', () => {
    render(
      <ScavengerSidebar
        open
        onClose={() => {}}
        artworks={[{ objectid: 1 }]}
        foundIds={new Set()}
      />
    )
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <ScavengerSidebar
        open
        onClose={onClose}
        artworks={ARTWORKS}
        foundIds={new Set()}
      />
    )
    await user.click(screen.getByLabelText('Close sidebar'))
    expect(onClose).toHaveBeenCalled()
  })
})
