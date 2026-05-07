import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AboutModal, HelpModal } from '../InfoModals'

describe('AboutModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AboutModal isOpen={false} onClose={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the About title and content when open', () => {
    render(<AboutModal isOpen onClose={() => {}} />)
    expect(screen.getByText('About ArtScape')).toBeInTheDocument()
    expect(screen.getByText(/PUAM ArtScape is an interactive/)).toBeInTheDocument()
  })

  it('lists each contributor', () => {
    render(<AboutModal isOpen onClose={() => {}} />)
    expect(screen.getByText('Dev Patel')).toBeInTheDocument()
    expect(screen.getByText('Arnav Sadeesh')).toBeInTheDocument()
    expect(screen.getByText('Arnav Ambre')).toBeInTheDocument()
    expect(screen.getByText('Sakthivel Vijayakumar')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AboutModal isOpen onClose={onClose} />)
    await user.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<AboutModal isOpen onClose={onClose} />)
    fireEvent.click(container.querySelector('.info-modal-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when the modal body is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<AboutModal isOpen onClose={onClose} />)
    fireEvent.click(container.querySelector('.info-modal'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<AboutModal isOpen onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not respond to Escape when closed', () => {
    const onClose = vi.fn()
    render(<AboutModal isOpen={false} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('HelpModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <HelpModal isOpen={false} onClose={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows help sections', () => {
    render(<HelpModal isOpen onClose={() => {}} />)
    expect(screen.getByText('Help')).toBeInTheDocument()
    expect(screen.getByText('Exploring the Map')).toBeInTheDocument()
    expect(screen.getByText('Finding Artwork')).toBeInTheDocument()
    expect(screen.getByText('Leaderboard')).toBeInTheDocument()
  })

  it('renders troubleshooting items', () => {
    render(<HelpModal isOpen onClose={() => {}} />)
    expect(screen.getByText('Location not working?')).toBeInTheDocument()
    expect(screen.getByText('Photo not submitting?')).toBeInTheDocument()
    expect(screen.getByText('Pins not showing?')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<HelpModal isOpen onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking the body does not close', () => {
    const onClose = vi.fn()
    const { container } = render(<HelpModal isOpen onClose={onClose} />)
    fireEvent.click(container.querySelector('.info-modal'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
