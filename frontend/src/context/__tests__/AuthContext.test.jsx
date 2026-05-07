import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'

function Probe() {
  const { user, loading, guest, login, logout, continueAsGuest } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="guest">{String(guest)}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <button onClick={login}>login</button>
      <button onClick={logout}>logout</button>
      <button onClick={continueAsGuest}>guest</button>
    </div>
  )
}

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

describe('AuthContext', () => {
  it('starts loading then resolves to a logged-in user from /api/auth/me', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, email: 'a@x.com' }),
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    )
    expect(screen.getByTestId('user')).toHaveTextContent('a@x.com')
  })

  it('handles {user: null} response shape', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: null }),
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    )
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('falls back to null user on fetch failure', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('boom'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    )
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('continueAsGuest sets guest=true', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: null }),
    })

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    )
    await user.click(screen.getByText('guest'))
    expect(screen.getByTestId('guest')).toHaveTextContent('true')
  })

  it('login sets window.location.href', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: null }),
    })

    // jsdom by default does not allow assignment of href; redefine.
    delete window.location
    window.location = { href: '' }

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    )
    await user.click(screen.getByText('login'))
    expect(window.location.href).toBe('/api/auth/login')
  })

  it('logout calls /api/auth/logout and clears user + guest', async () => {
    globalThis.fetch
      // initial /api/auth/me
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, email: 'a@x.com' }),
      })
      // logout call
      .mockResolvedValueOnce({ ok: true })

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('a@x.com')
    )

    await user.click(screen.getByText('logout'))
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('none')
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('logout swallows fetch errors', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, email: 'a@x.com' }),
      })
      .mockRejectedValueOnce(new Error('network down'))

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('a@x.com')
    )

    await act(async () => {
      await user.click(screen.getByText('logout'))
    })
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })
})
