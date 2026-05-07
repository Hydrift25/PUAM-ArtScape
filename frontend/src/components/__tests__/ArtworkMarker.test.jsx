import { describe, it, expect } from 'vitest'
import {
  createNearbyMarkerEl,
  createAllMarkerEl,
  createUserMarkerEl,
} from '../ArtworkMarker'

describe('ArtworkMarker factories', () => {
  it('creates a nearby marker with the right classes', () => {
    const el = createNearbyMarkerEl()
    expect(el.tagName).toBe('DIV')
    expect(el.classList.contains('custom-marker')).toBe(true)
    expect(el.classList.contains('marker-nearby')).toBe(true)
    expect(el.querySelector('.marker-inner')).not.toBeNull()
  })

  it('creates an all-artworks marker with the right classes', () => {
    const el = createAllMarkerEl()
    expect(el.classList.contains('custom-marker')).toBe(true)
    expect(el.classList.contains('marker-all')).toBe(true)
    expect(el.querySelector('.marker-inner')).not.toBeNull()
  })

  it('creates a user marker', () => {
    const el = createUserMarkerEl()
    expect(el.tagName).toBe('DIV')
    expect(el.classList.contains('user-location-marker')).toBe(true)
  })

  it('returns a fresh element on each call', () => {
    const a = createNearbyMarkerEl()
    const b = createNearbyMarkerEl()
    expect(a).not.toBe(b)
  })
})
