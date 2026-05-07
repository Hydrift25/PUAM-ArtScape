import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NearestArtworksPanel from '../NearestArtworksPanel'

describe('NearestArtworksPanel', () => {
  it('renders nothing when no artworks', () => {
    const { container } = render(
      <NearestArtworksPanel
        artworks={[]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when artworks is null/undefined', () => {
    const { container } = render(
      <NearestArtworksPanel
        artworks={null}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders rows with rank labels and titles', () => {
    const artworks = [
      { objectid: 1, title: 'First', distance: 50 },
      { objectid: 2, title: 'Second', distance: 800 },
      { objectid: 3, title: 'Third', distance: 1500 },
    ]
    render(
      <NearestArtworksPanel
        artworks={artworks}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(screen.getByText('Nearest Artworks')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })

  it('formats distance under 1000m as meters', () => {
    render(
      <NearestArtworksPanel
        artworks={[{ objectid: 1, title: 'A', distance: 250 }]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(screen.getByText('250m')).toBeInTheDocument()
  })

  it('formats distance >= 1000m as kilometers', () => {
    render(
      <NearestArtworksPanel
        artworks={[{ objectid: 1, title: 'A', distance: 1500 }]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(screen.getByText('1.5km')).toBeInTheDocument()
  })

  it('omits distance badge when distance is missing', () => {
    render(
      <NearestArtworksPanel
        artworks={[{ objectid: 1, title: 'A' }]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(screen.queryByText(/m$|km$/)).not.toBeInTheDocument()
  })

  it('falls back to "Untitled" when title is empty', () => {
    render(
      <NearestArtworksPanel
        artworks={[{ objectid: 1, distance: 100 }]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('renders the artist when present', () => {
    render(
      <NearestArtworksPanel
        artworks={[
          { objectid: 1, title: 'Title', artist: 'Picasso', distance: 100 },
        ]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    expect(screen.getByText('Picasso')).toBeInTheDocument()
  })

  it('renders an image when image_url is provided', () => {
    render(
      <NearestArtworksPanel
        artworks={[
          {
            objectid: 1,
            title: 'Title',
            distance: 100,
            image_url: 'https://example.com/iiif',
          },
        ]}
        onSelect={() => {}}
        onMinimize={() => {}}
      />
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'src',
      'https://example.com/iiif/full/120,/0/default.jpg'
    )
  })

  it('calls onSelect when a row is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <NearestArtworksPanel
        artworks={[{ objectid: 7, title: 'X', distance: 100 }]}
        onSelect={onSelect}
        onMinimize={() => {}}
      />
    )
    await user.click(screen.getByText('X'))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ objectid: 7 })
    )
  })

  it('calls onMinimize when the close button is clicked', async () => {
    const onMinimize = vi.fn()
    const user = userEvent.setup()
    render(
      <NearestArtworksPanel
        artworks={[{ objectid: 1, title: 'X', distance: 100 }]}
        onSelect={() => {}}
        onMinimize={onMinimize}
      />
    )
    await user.click(screen.getByLabelText('Minimize panel'))
    expect(onMinimize).toHaveBeenCalled()
  })

  it('applies "hidden" modifier when hidden prop is true', () => {
    const { container } = render(
      <NearestArtworksPanel
        artworks={[{ objectid: 1, title: 'X', distance: 100 }]}
        onSelect={() => {}}
        onMinimize={() => {}}
        hidden
      />
    )
    expect(container.firstChild).toHaveClass('nearest-panel--hidden')
  })
})
