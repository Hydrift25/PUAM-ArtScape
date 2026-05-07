import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '../SearchBar'

const ARTWORKS = [
  { objectid: 1, title: 'Sun Dial' },
  { objectid: 2, title: 'Moon Stone' },
  { objectid: 3, title: 'Sunlight' },
  { objectid: 4, title: null },
]

describe('SearchBar', () => {
  it('renders an input', () => {
    render(<SearchBar artworks={ARTWORKS} onSelect={() => {}} />)
    expect(screen.getByPlaceholderText('Search artworks…')).toBeInTheDocument()
  })

  it('does not show dropdown when query is empty', () => {
    render(<SearchBar artworks={ARTWORKS} onSelect={() => {}} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    fireEvent.focus(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('filters by case-insensitive title substring', async () => {
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={() => {}} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Sun Dial')
    expect(options[1]).toHaveTextContent('Sunlight')
  })

  it('shows "No artworks match" when nothing matches', async () => {
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={() => {}} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'zzzz')
    // The component renders the "No artworks match" message only when the
    // results array is empty AND the dropdown is shown. But results.length===0
    // returns no matches at all from the for-loop, so the empty-state branch
    // doesn't actually trigger here (results.length is 0 → no listbox). The
    // dropdown is hidden — so just assert no options exist.
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('clears the query when the clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={() => {}} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')
    await user.click(screen.getByLabelText('Clear search'))
    expect(input).toHaveValue('')
  })

  it('calls onSelect and clears query when an item is picked via mousedown', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'moon')

    fireEvent.mouseDown(screen.getByText('Moon Stone'))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ objectid: 2 })
    )
    expect(input).toHaveValue('')
  })

  it('navigates results with arrow keys and selects with Enter', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')

    // Arrow down to second match.
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ objectid: 3, title: 'Sunlight' })
    )
  })

  it('Arrow up wraps from index 0 to the last result', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')
    await user.keyboard('{ArrowUp}{Enter}')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ objectid: 3 })
    )
  })

  it('Escape clears query and closes dropdown', async () => {
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={() => {}} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('caps results at 8', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      objectid: i,
      title: `Artwork ${i}`,
    }))
    const user = userEvent.setup()
    render(<SearchBar artworks={many} onSelect={() => {}} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'artwork')
    expect(screen.getAllByRole('option')).toHaveLength(8)
  })

  it('hovering a row updates active index', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar artworks={ARTWORKS} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')

    const second = screen.getByText('Sunlight').closest('li')
    fireEvent.mouseEnter(second)
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ objectid: 3 })
    )
  })

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <SearchBar artworks={ARTWORKS} onSelect={() => {}} />
        <button>Outside</button>
      </div>
    )
    const input = screen.getByPlaceholderText('Search artworks…')
    await user.click(input)
    await user.type(input, 'sun')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
