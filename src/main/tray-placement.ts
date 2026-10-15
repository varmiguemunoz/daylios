export interface Box {
  x: number
  y: number
  width: number
  height: number
}

const GAP = 6
const MARGIN = 8

export function placeNearTray(icon: Box, area: Box, width: number, height: number): Box {
  const x = Math.round(icon.x + icon.width / 2 - width / 2)
  const left = Math.min(Math.max(x, area.x + MARGIN), area.x + area.width - width - MARGIN)
  const middle = area.y + area.height / 2
  if (icon.y + icon.height / 2 > middle) {
    const bottom = Math.min(icon.y - GAP, area.y + area.height - MARGIN)
    const fitted = Math.min(height, bottom - area.y - MARGIN)
    return { x: left, y: bottom - fitted, width, height: fitted }
  }
  const top = Math.max(Math.round(icon.y + icon.height + GAP), area.y + GAP)
  return { x: left, y: top, width, height: Math.min(height, area.y + area.height - top - MARGIN) }
}
