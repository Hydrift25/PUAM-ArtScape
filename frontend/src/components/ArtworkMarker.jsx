export function createNearbyMarkerEl() {
  const el = document.createElement('div')
  el.className = 'custom-marker marker-nearby'
  el.innerHTML = '<div class="marker-inner"></div>'
  return el
}

export function createAllMarkerEl() {
  const el = document.createElement('div')
  el.className = 'custom-marker marker-all'
  el.innerHTML = '<div class="marker-inner"></div>'
  return el
}

export function createUserMarkerEl() {
  const el = document.createElement('div')
  el.className = 'user-location-marker'
  return el
}