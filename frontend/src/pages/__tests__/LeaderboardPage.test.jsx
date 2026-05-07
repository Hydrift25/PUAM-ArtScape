import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeaderboardPage from '../LeaderboardPage'

// Mock useAuth — we don't want the real provider hitting /api/auth/me.
const mockAuth = vi.fn()
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth(),
}))

function makeFetch(urlsToResponses) {
  // urlsToResponses: { '/api/leaderboard': data, '/api/leaderboard/me': data }
  return vi.fn(async (url) => {
    if (url in urlsToResponses) {
      return {
        ok: true,
        json: () => Promise.resolve(urlsToResponses[url]),
      }
    }
    return { ok: false, json: () => Promise.resolve(null) }
  })
}

beforeEach(() => {
  mockAuth.mockReturnValue({ user: { id: 1, display_name: 'Me' } })
})

describe('LeaderboardPage', () => {
  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) // never resolves
    render(<LeaderboardPage />)
    expect(screen.getByText('Loading rankings…')).toBeInTheDocument()
  })

  it('shows empty state when no rankings', async () => {
    globalThis.fetch = makeFetch({ '/api/leaderboard': [] })
    render(<LeaderboardPage />)
    await waitFor(() =>
      expect(screen.getByText(/No rankings yet/)).toBeInTheDocument()
    )
  })

  it('renders podium for top 3', async () => {
    globalThis.fetch = makeFetch({
      '/api/leaderboard': [
        { id: 1, display_name: 'Alice Smith', total_finds: 5, score: 50, rank: 1 },
        { id: 2, display_name: 'Bob Jones',   total_finds: 4, score: 40, rank: 2 },
        { id: 3, display_name: 'Carol Lee',   total_finds: 3, score: 30, rank: 3 },
      ],
      '/api/leaderboard/me': null,
    })
    render(<LeaderboardPage />)
    await waitFor(() =>
      expect(screen.getByText('Alice')).toBeInTheDocument()
    )
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
    expect(screen.getByText('50 pts')).toBeInTheDocument()
  })

  it('renders the rankings list past the podium', async () => {
    const rankings = []
    for (let i = 1; i <= 8; i++) {
      rankings.push({
        id: i,
        display_name: `User ${i}`,
        total_finds: 10 - i,
        score: (10 - i) * 10,
        rank: i,
      })
    }
    globalThis.fetch = makeFetch({
      '/api/leaderboard': rankings,
      '/api/leaderboard/me': null,
    })
    render(<LeaderboardPage />)
    await waitFor(() =>
      expect(screen.getByText('User 4')).toBeInTheDocument()
    )
    // Users 4-8 are shown in the rankings list.
    expect(screen.getByText('User 8')).toBeInTheDocument()
  })

  it('shows the "Show more" button when more than 10 rankings', async () => {
    const rankings = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      display_name: `User ${i + 1}`,
      total_finds: 15 - i,
      score: (15 - i) * 10,
      rank: i + 1,
    }))
    globalThis.fetch = makeFetch({
      '/api/leaderboard': rankings,
      '/api/leaderboard/me': null,
    })
    const user = userEvent.setup()
    render(<LeaderboardPage />)
    await waitFor(() => screen.getByText('Show more'))
    expect(screen.queryByText('User 11')).not.toBeInTheDocument()

    await user.click(screen.getByText('Show more'))
    expect(screen.getByText('User 11')).toBeInTheDocument()
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('renders "Your Rank" card when user is unranked', async () => {
    globalThis.fetch = makeFetch({
      '/api/leaderboard': [
        { id: 5, display_name: 'A', total_finds: 1, score: 10, rank: 1 },
      ],
      '/api/leaderboard/me': null,
    })
    render(<LeaderboardPage />)
    await waitFor(() =>
      expect(screen.getByText('Not yet ranked')).toBeInTheDocument()
    )
    expect(screen.getByText('Find artworks to earn points')).toBeInTheDocument()
  })

  it('renders "Your Rank" card when user is past top 10', async () => {
    const rankings = Array.from({ length: 10 }, (_, i) => ({
      id: i + 100,
      display_name: `User ${i + 1}`,
      total_finds: 10 - i,
      score: (10 - i) * 10,
      rank: i + 1,
    }))
    globalThis.fetch = makeFetch({
      '/api/leaderboard': rankings,
      '/api/leaderboard/me': {
        id: 1,
        display_name: 'Me',
        total_finds: 1,
        score: 10,
        rank: 15,
      },
    })
    render(<LeaderboardPage />)
    await waitFor(() => screen.getByText('5 below'))
    // "you" tag appears next to me row.
    expect(screen.getByText('you')).toBeInTheDocument()
  })

  it('does not query /me when no user is logged in', async () => {
    mockAuth.mockReturnValue({ user: null })
    const fetchMock = makeFetch({ '/api/leaderboard': [] })
    globalThis.fetch = fetchMock
    render(<LeaderboardPage />)
    await waitFor(() => screen.getByText(/No rankings yet/))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/leaderboard', expect.anything())
  })

  it('logs and recovers when fetch fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom'))
    render(<LeaderboardPage />)
    await waitFor(() => expect(errSpy).toHaveBeenCalled())
  })
})
