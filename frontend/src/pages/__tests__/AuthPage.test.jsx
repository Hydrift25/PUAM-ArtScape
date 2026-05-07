import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthPage from '../AuthPage'
import { AuthProvider } from '../../context/AuthContext'

function renderWithAuth(initialUrl = '/') {
  // Set the URL — AuthPage reads window.location.search at render.
  window.history.replaceState({}, '', initialUrl)
  return render(
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  )
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ user: null }),
  })
})

describe('AuthPage', () => {
  it('renders title and tagline', async () => {
    renderWithAuth()
    expect(screen.getByText('Princeton ArtScape')).toBeInTheDocument()
    expect(screen.getByText(/There's art around every corner/)).toBeInTheDocument()
  })

  it('renders the welcome subheading by default', () => {
    renderWithAuth()
    expect(
      screen.getByText('Sign in to start your art exploration journey')
    ).toBeInTheDocument()
  })

  it('shows cancellation message when ?auth_cancelled=true', () => {
    renderWithAuth('/?auth_cancelled=true')
    expect(screen.getByText(/Sign-in was cancelled/)).toBeInTheDocument()
  })

  it('renders Sign in with Google button', () => {
    renderWithAuth()
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('renders Continue to Map (guest) button', () => {
    renderWithAuth()
    expect(screen.getByText('Continue to Map')).toBeInTheDocument()
  })

  it('clicking the Sign in button redirects (calls login)', async () => {
    delete window.location
    window.location = { href: '', search: '' }

    const user = userEvent.setup()
    renderWithAuth()
    await user.click(screen.getByText('Sign in with Google'))
    expect(window.location.href).toBe('/api/auth/login')
  })

  it('renders the stat tiles', () => {
    renderWithAuth()
    expect(screen.getByText('50+')).toBeInTheDocument()
    expect(screen.getByText('Artworks')).toBeInTheDocument()
    expect(screen.getByText('GPS')).toBeInTheDocument()
    expect(screen.getByText('Hunt')).toBeInTheDocument()
  })

  it('opens About modal from footer', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByText('About ArtScape')).toBeInTheDocument()
  })

  it('opens Help modal from footer', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await user.click(screen.getByRole('button', { name: 'Help' }))
    await waitFor(() =>
      expect(screen.getByText('Exploring the Map')).toBeInTheDocument()
    )
  })
})
