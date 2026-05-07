import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileDropdown from '../ProfileDropdown'

const USER = {
  display_name: 'Test User',
  email: 'test@example.com',
  avatar_url: null,
}

describe('ProfileDropdown', () => {
  it('shows initials when no avatar_url', () => {
    render(<ProfileDropdown user={USER} onLogout={() => {}} />)
    expect(screen.getByText('TU')).toBeInTheDocument()
  })

  it('shows ? initial when no name', () => {
    render(
      <ProfileDropdown user={{ display_name: null }} onLogout={() => {}} />
    )
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renders avatar image when avatar_url provided', () => {
    render(
      <ProfileDropdown
        user={{ ...USER, avatar_url: 'https://av.png' }}
        onLogout={() => {}}
      />
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://av.png')
  })

  it('opens menu when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown user={USER} onLogout={() => {}} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Open account menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('toggles menu off on second click', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown user={USER} onLogout={() => {}} />)
    const trigger = screen.getByLabelText('Open account menu')
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu on Escape', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown user={USER} onLogout={() => {}} />)
    await user.click(screen.getByLabelText('Open account menu'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu on outside mousedown', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <ProfileDropdown user={USER} onLogout={() => {}} />
        <button>Outside</button>
      </div>
    )
    await user.click(screen.getByLabelText('Open account menu'))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls onLogout when Sign Out clicked', async () => {
    const onLogout = vi.fn()
    const user = userEvent.setup()
    render(<ProfileDropdown user={USER} onLogout={onLogout} />)
    await user.click(screen.getByLabelText('Open account menu'))
    await user.click(screen.getByText('Sign Out'))
    expect(onLogout).toHaveBeenCalled()
  })

  it('opens About modal from menu', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown user={USER} onLogout={() => {}} />)
    await user.click(screen.getByLabelText('Open account menu'))
    await user.click(screen.getByRole('menuitem', { name: /About/ }))
    expect(screen.getByText('About ArtScape')).toBeInTheDocument()
  })

  it('opens Help modal from menu', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown user={USER} onLogout={() => {}} />)
    await user.click(screen.getByLabelText('Open account menu'))
    await user.click(screen.getByRole('menuitem', { name: /Help/ }))
    expect(screen.getByText('Exploring the Map')).toBeInTheDocument()
  })

  it('handles missing user gracefully', () => {
    render(<ProfileDropdown user={null} onLogout={() => {}} />)
    // initials fallback
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('truncates long initials to 2 characters', () => {
    render(
      <ProfileDropdown
        user={{ display_name: 'A B C D E' }}
        onLogout={() => {}}
      />
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
  })
})
