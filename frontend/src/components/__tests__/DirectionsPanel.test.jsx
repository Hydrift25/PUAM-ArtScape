import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DirectionsPanel from '../DirectionsPanel'

describe('DirectionsPanel', () => {
  it('renders nothing when navigationState is null', () => {
    const { container } = render(
      <DirectionsPanel
        navigationState={null}
        onBeginNavigation={() => {}}
        onEndNavigation={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  describe('preview mode', () => {
    const previewState = {
      mode: 'preview',
      destination: { title: 'The Sphere' },
      totalDistance: 320,
      totalDuration: 240,
    }

    it('shows destination title and call-to-action buttons', () => {
      render(
        <DirectionsPanel
          navigationState={previewState}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      expect(screen.getByText('The Sphere')).toBeInTheDocument()
      expect(screen.getByText('Start Navigation')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('formats distance under 160m in feet, longer in miles', () => {
      const { rerender } = render(
        <DirectionsPanel
          navigationState={{ ...previewState, totalDistance: 50 }}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      // 50m * 3.28084 = 164.04 → /10 → 16.4 → round → 16 → *10 → 160
      expect(screen.getByText(/160 ft/)).toBeInTheDocument()

      rerender(
        <DirectionsPanel
          navigationState={{ ...previewState, totalDistance: 1610 }}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      expect(screen.getByText(/1\.0 mi/)).toBeInTheDocument()
    })

    it('formats duration under 60s as "< 1 min"', () => {
      render(
        <DirectionsPanel
          navigationState={{ ...previewState, totalDuration: 30 }}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      expect(screen.getByText(/< 1 min/)).toBeInTheDocument()
    })

    it('formats duration in minutes when over 60s', () => {
      render(
        <DirectionsPanel
          navigationState={{ ...previewState, totalDuration: 240 }}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      // ceil(240/60) === 4
      expect(screen.getByText(/4 min/)).toBeInTheDocument()
    })

    it('falls back to "Artwork" when destination has no title', () => {
      render(
        <DirectionsPanel
          navigationState={{ ...previewState, destination: {} }}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      expect(screen.getByText('Artwork')).toBeInTheDocument()
    })

    it('calls onBeginNavigation and onEndNavigation', async () => {
      const onBegin = vi.fn()
      const onEnd = vi.fn()
      const user = userEvent.setup()
      render(
        <DirectionsPanel
          navigationState={previewState}
          onBeginNavigation={onBegin}
          onEndNavigation={onEnd}
        />
      )
      await user.click(screen.getByText('Start Navigation'))
      expect(onBegin).toHaveBeenCalled()
      await user.click(screen.getByText('Cancel'))
      expect(onEnd).toHaveBeenCalled()
    })

    it('applies guest class and shows guest fill when isGuest', () => {
      const { container } = render(
        <DirectionsPanel
          navigationState={previewState}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
          isGuest
        />
      )
      expect(container.querySelector('.directions-panel--guest')).toBeTruthy()
      expect(container.querySelector('.directions-guest-fill')).toBeTruthy()
    })
  })

  describe('navigating mode', () => {
    const navState = {
      mode: 'navigating',
      arrived: false,
      destination: { title: 'X' },
      distanceRemaining: 320,
      steps: [
        { instruction: 'Head north', distance: 100 },
        { instruction: 'Turn right', distance: 220 },
      ],
    }

    it('shows distance and ETA summary', () => {
      render(
        <DirectionsPanel
          navigationState={navState}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      // ceil(320/80) = 4 minutes
      expect(screen.getByText('4 min')).toBeInTheDocument()
    })

    it('expands to show steps when summary is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <DirectionsPanel
          navigationState={navState}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      const panel = container.querySelector('.directions-panel')
      expect(panel.classList.contains('directions-panel--expanded')).toBe(false)

      await user.click(container.querySelector('.directions-summary'))
      expect(panel.classList.contains('directions-panel--expanded')).toBe(true)
      expect(screen.getByText('Head north')).toBeInTheDocument()
      expect(screen.getByText('Turn right')).toBeInTheDocument()
    })

    it('clicking End calls onEndNavigation but not the summary toggle', async () => {
      const onEnd = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <DirectionsPanel
          navigationState={navState}
          onBeginNavigation={() => {}}
          onEndNavigation={onEnd}
        />
      )
      await user.click(screen.getByText('End'))
      expect(onEnd).toHaveBeenCalledTimes(1)
      // panel should still be unexpanded — stopPropagation worked
      expect(
        container.querySelector('.directions-panel--expanded')
      ).toBeFalsy()
    })
  })

  describe('arrived state', () => {
    it('shows arrival UI', async () => {
      const onEnd = vi.fn()
      const user = userEvent.setup()
      render(
        <DirectionsPanel
          navigationState={{
            mode: 'navigating',
            arrived: true,
            destination: { title: 'Done!' },
            distanceRemaining: 0,
            steps: [],
          }}
          onBeginNavigation={() => {}}
          onEndNavigation={onEnd}
        />
      )
      expect(screen.getByText("You've arrived!")).toBeInTheDocument()
      expect(screen.getByText('Done!')).toBeInTheDocument()
      await user.click(screen.getByText('Done'))
      expect(onEnd).toHaveBeenCalled()
    })

    it('falls back to "Artwork" when no title', () => {
      render(
        <DirectionsPanel
          navigationState={{
            mode: 'navigating',
            arrived: true,
            destination: {},
            distanceRemaining: 0,
            steps: [],
          }}
          onBeginNavigation={() => {}}
          onEndNavigation={() => {}}
        />
      )
      expect(screen.getByText('Artwork')).toBeInTheDocument()
    })
  })
})
