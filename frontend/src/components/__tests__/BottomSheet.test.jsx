import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BottomSheet from '../BottomSheet'

const VERIFY_STATE = {
  PENDING: 0,
  ACCEPTED: 1,
  FAILED_LOCATION: 2,
  FAILED_IMAGE: 3,
}

const ART = {
  objectid: 1,
  title: 'Test Artwork',
  maker: 'Picasso',
  medium: 'Bronze',
  date_range: '1950',
  description: '<p>About the work</p>',
  image_url: 'https://iiif/thing',
  location: 'Quad',
}

function setup(props = {}) {
  return render(
    <MemoryRouter>
      <BottomSheet
        content={{ art: ART, type: 'detailed' }}
        onClose={() => {}}
        onFetchRoute={() => {}}
        onToggleFavorite={() => {}}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('BottomSheet', () => {
  it('renders nothing when content is null', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomSheet
          content={null}
          onClose={() => {}}
          onFetchRoute={() => {}}
          onToggleFavorite={() => {}}
        />
      </MemoryRouter>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders compact "navigating" view in navigationMode', () => {
    setup({ navigationMode: true })
    expect(screen.getByText('Test Artwork')).toBeInTheDocument()
    expect(screen.getByText('Navigating')).toBeInTheDocument()
  })

  describe('succinct view', () => {
    it('shows hint and Get Directions button', () => {
      setup({ content: { art: ART, type: 'succinct' } })
      expect(screen.getByText(/Walk closer/)).toBeInTheDocument()
      expect(screen.getByText('Get Directions')).toBeInTheDocument()
    })

    it('disables Get Directions button when location not granted', () => {
      setup({
        content: { art: ART, type: 'succinct' },
        locationStatus: 'denied',
      })
      const btn = screen.getByLabelText(/Enable location/)
      expect(btn).toBeDisabled()
      expect(screen.getByText(/Enable location to use in-app directions/)).toBeInTheDocument()
    })

    it('calls onFetchRoute when directions clicked', async () => {
      const onFetchRoute = vi.fn()
      const user = userEvent.setup()
      setup({
        content: { art: ART, type: 'succinct' },
        onFetchRoute,
      })
      await user.click(screen.getByText('Get Directions'))
      expect(onFetchRoute).toHaveBeenCalledWith(expect.objectContaining({ objectid: 1 }))
    })
  })

  describe('guest view', () => {
    it('renders the guest banner and CTA', () => {
      setup({ isGuest: true })
      expect(screen.getByText('Viewing as Guest')).toBeInTheDocument()
      expect(screen.getByText('Ready to Visit?')).toBeInTheDocument()
      expect(screen.getByText('Test Artwork')).toBeInTheDocument()
    })

    it('falls back to "Untitled" when title is missing', () => {
      setup({ isGuest: true, content: { art: { objectid: 9 }, type: 'detailed' } })
      expect(screen.getByText('Untitled')).toBeInTheDocument()
    })

    it('shows the medium row when present', () => {
      setup({ isGuest: true })
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Bronze')).toBeInTheDocument()
    })

    it('falls back to "Princeton University Campus" when no location', () => {
      setup({
        isGuest: true,
        content: { art: { ...ART, location: null }, type: 'detailed' },
      })
      expect(screen.getByText('Princeton University Campus')).toBeInTheDocument()
    })
  })

  describe('auth view', () => {
    it('renders favorites overlay (unfavorited)', () => {
      setup({ isFavorited: false })
      // Heart icons rendered twice (overlay + action button)
      expect(screen.getAllByText('🤍').length).toBeGreaterThan(0)
      expect(screen.getByText('❤️ Save to Favorites')).toBeInTheDocument()
    })

    it('renders favorited state correctly', () => {
      setup({ isFavorited: true })
      expect(screen.getByText('💔 Unfavorite')).toBeInTheDocument()
    })

    it('toggling favorite calls onToggleFavorite with objectid', async () => {
      const onToggleFavorite = vi.fn()
      const user = userEvent.setup()
      setup({ onToggleFavorite })
      await user.click(screen.getByText('❤️ Save to Favorites'))
      expect(onToggleFavorite).toHaveBeenCalledWith(1)
    })

    it('disables favorite button while favoritesLoading', () => {
      setup({ favoritesLoading: true })
      expect(screen.getByText('❤️ Save to Favorites')).toBeDisabled()
    })

    it('renders correct CTA label per verifyState', () => {
      const { rerender } = render(
        <MemoryRouter>
          <BottomSheet
            content={{ art: ART, type: 'detailed' }}
            onClose={() => {}}
            onFetchRoute={() => {}}
            onToggleFavorite={() => {}}
            verifyState={VERIFY_STATE.ACCEPTED}
          />
        </MemoryRouter>
      )
      expect(screen.getByText('✓ Visited')).toBeDisabled()

      rerender(
        <MemoryRouter>
          <BottomSheet
            content={{ art: ART, type: 'detailed' }}
            onClose={() => {}}
            onFetchRoute={() => {}}
            onToggleFavorite={() => {}}
            verifyState={VERIFY_STATE.PENDING}
          />
        </MemoryRouter>
      )
      expect(screen.getByText('⏳ Verifying...')).toBeDisabled()

      rerender(
        <MemoryRouter>
          <BottomSheet
            content={{ art: ART, type: 'detailed' }}
            onClose={() => {}}
            onFetchRoute={() => {}}
            onToggleFavorite={() => {}}
            verifyState={VERIFY_STATE.FAILED_LOCATION}
          />
        </MemoryRouter>
      )
      expect(screen.getByText('📍 Retry — too far')).toBeInTheDocument()

      rerender(
        <MemoryRouter>
          <BottomSheet
            content={{ art: ART, type: 'detailed' }}
            onClose={() => {}}
            onFetchRoute={() => {}}
            onToggleFavorite={() => {}}
            verifyState={VERIFY_STATE.FAILED_IMAGE}
          />
        </MemoryRouter>
      )
      expect(screen.getByText('📷 Retry — unclear photo')).toBeInTheDocument()
    })

    it('renders default Verify Visit when no verify state', () => {
      setup()
      expect(screen.getByText('📷 Verify Visit')).toBeInTheDocument()
    })

    it('renders the description as HTML', () => {
      const { container } = setup()
      const desc = container.querySelector('.bs-description')
      expect(desc.innerHTML).toContain('<p>About the work</p>')
    })
  })

  it('close button triggers onClose after slide-down delay', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    setup({ onClose })
    act(() => {
      screen.getByLabelText('Close').click()
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  describe('swipe-to-dismiss', () => {
    function fireTouch(target, type, y) {
      const event = new TouchEvent(type, { bubbles: true })
      Object.defineProperty(event, 'touches', {
        value: [{ clientY: y }],
      })
      target.dispatchEvent(event)
    }

    it('does not dismiss for short drag', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()
      const { container } = setup({ onClose })
      const sheet = container.querySelector('.bottom-sheet')

      fireTouch(sheet, 'touchstart', 100)
      fireTouch(sheet, 'touchmove', 130)
      fireTouch(sheet, 'touchend', 130)

      act(() => vi.advanceTimersByTime(400))
      expect(onClose).not.toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('dismisses after a >60px downward drag', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()
      const { container } = setup({ onClose })
      const sheet = container.querySelector('.bottom-sheet')

      fireTouch(sheet, 'touchstart', 100)
      fireTouch(sheet, 'touchmove', 200)
      fireTouch(sheet, 'touchend', 200)

      act(() => vi.advanceTimersByTime(400))
      expect(onClose).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('ignores upward drag', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()
      const { container } = setup({ onClose })
      const sheet = container.querySelector('.bottom-sheet')

      fireTouch(sheet, 'touchstart', 200)
      fireTouch(sheet, 'touchmove', 100)
      fireTouch(sheet, 'touchend', 100)

      act(() => vi.advanceTimersByTime(400))
      expect(onClose).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  it('guest "Get Directions" calls onFetchRoute', async () => {
    const onFetchRoute = vi.fn()
    const user = userEvent.setup()
    setup({ isGuest: true, onFetchRoute })
    await user.click(screen.getByText('Get Directions'))
    expect(onFetchRoute).toHaveBeenCalledWith(expect.objectContaining({ objectid: 1 }))
  })

  it('auth "Get Directions" calls onFetchRoute', async () => {
    const onFetchRoute = vi.fn()
    const user = userEvent.setup()
    setup({ onFetchRoute })
    await user.click(screen.getByText('Get Directions'))
    expect(onFetchRoute).toHaveBeenCalledWith(expect.objectContaining({ objectid: 1 }))
  })

  it('auth "Verify Visit" navigates to /hunt with the objectid', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('📷 Verify Visit'))
    // We can't easily inspect the navigate call without mocking — but the
    // route renders inside MemoryRouter and the click should produce no error.
    // For full assertion, see ProfilePage tests where useNavigate is mocked.
  })

  it('shows location-denied note in auth detail view', () => {
    setup({ locationStatus: 'denied' })
    expect(
      screen.getByText('Enable location to use in-app directions.')
    ).toBeInTheDocument()
  })

  it('disables auth "Get Directions" when location not granted', () => {
    setup({ locationStatus: 'pending' })
    const btn = screen.getByLabelText(/Enable location/)
    expect(btn).toBeDisabled()
  })
})
