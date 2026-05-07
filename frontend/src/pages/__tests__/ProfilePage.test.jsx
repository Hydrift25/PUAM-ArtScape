import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../ProfilePage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseAuth = vi.fn()
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function makeFetch(map) {
  return vi.fn(async (url) => {
    if (url in map) {
      return { ok: true, json: () => Promise.resolve(map[url]) }
    }
    return { ok: false, json: () => Promise.resolve([]) }
  })
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockUseAuth.mockReturnValue({
    user: { display_name: 'Test User', email: 'test@x.com' },
    logout: vi.fn().mockResolvedValue(undefined),
  })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  )
}

describe('ProfilePage', () => {
  it('renders user name and email', async () => {
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [],
      '/api/artworks/favorites': [],
      '/api/artworks': [],
    })
    renderPage()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@x.com')).toBeInTheDocument()
  })

  it('falls back to Explorer when user has no name', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn().mockResolvedValue(undefined),
    })
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [],
      '/api/artworks/favorites': [],
      '/api/artworks': [],
    })
    renderPage()
    expect(screen.getByText('Explorer')).toBeInTheDocument()
  })

  it('shows verified count and favorites count', async () => {
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [
        { objectid: 1, verify_state: 1, found_at: '2025-04-01T00:00:00', title: 'A', image_url: 'i' },
        { objectid: 2, verify_state: 2, found_at: '2025-04-02T00:00:00', title: 'B', image_url: 'i' },
      ],
      '/api/artworks/favorites': [
        { objectid: 3, saved_at: '2025-04-03T00:00:00', title: 'C', image_url: 'i' },
      ],
      '/api/artworks': [{}, {}, {}, {}],
    })
    renderPage()
    await waitFor(() =>
      // verified=1, favorited=1 in the stat row
      expect(screen.getByText(/Artworks Found: 1\/4/)).toBeInTheDocument()
    )
  })

  it('renders empty galleries when nothing is found or favorited', async () => {
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [],
      '/api/artworks/favorites': [],
      '/api/artworks': [],
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/No artworks verified yet/)).toBeInTheDocument()
    )
    // Switch to favorites tab.
    const user = userEvent.setup()
    await user.click(screen.getByText('Favorites'))
    expect(screen.getByText(/No favorites yet/)).toBeInTheDocument()
  })

  it('renders verified gallery with images', async () => {
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [
        {
          objectid: 1,
          verify_state: 1,
          title: 'Sun',
          image_url: 'https://iiif/sun',
          found_at: '2025-04-01T00:00:00',
        },
      ],
      '/api/artworks/favorites': [],
      '/api/artworks': [{}],
    })
    renderPage()
    const img = await screen.findByAltText('Sun')
    expect(img).toHaveAttribute('src', 'https://iiif/sun/full/400,/0/default.jpg')
  })

  it('shows recent activity sorted desc by time', async () => {
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [
        {
          objectid: 1,
          verify_state: 1,
          title: 'Older Find',
          found_at: '2025-04-01T00:00:00',
        },
      ],
      '/api/artworks/favorites': [
        {
          objectid: 2,
          title: 'Newer Fav',
          saved_at: '2025-04-05T00:00:00',
        },
      ],
      '/api/artworks': [{}],
    })
    renderPage()
    await waitFor(() => screen.getByText('Newer Fav'))
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Newer Fav')
    expect(items[1]).toHaveTextContent('Older Find')
  })

  it('clicking the CTA navigates to /hunt', async () => {
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [],
      '/api/artworks/favorites': [],
      '/api/artworks': [],
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Start Scavenger Hunt'))
    expect(mockNavigate).toHaveBeenCalledWith('/hunt')
  })

  it('logout button calls logout and navigates home', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      user: { display_name: 'X', email: 'x@x' },
      logout,
    })
    globalThis.fetch = makeFetch({
      '/api/artworks/visited': [],
      '/api/artworks/favorites': [],
      '/api/artworks': [],
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Log Out'))
    await waitFor(() => expect(logout).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('logs and recovers when fetch fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom'))
    renderPage()
    await waitFor(() => expect(errSpy).toHaveBeenCalled())
  })
})
