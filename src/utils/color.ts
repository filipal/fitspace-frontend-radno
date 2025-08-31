// Simple color utilities for skin tones
export function hexToHsl(hex: string) {
  let r = 0, g = 0, b = 0
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export function hslToHex(h: number, s: number, l: number) {
  h = (h % 360 + 360) % 360
  s = Math.max(0, Math.min(100, s))
  l = Math.max(0, Math.min(100, l))
  const hh = h / 360, ss = s / 100, ll = l / 100
  let r: number, g: number, b: number
  if (ss === 0) {
    r = g = b = ll
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
    const p = 2 * ll - q
    r = hue2rgb(p, q, hh + 1 / 3)
    g = hue2rgb(p, q, hh)
    b = hue2rgb(p, q, hh - 1 / 3)
  }
  const toHex = (x: number) => {
    const v = Math.round(x * 255).toString(16).padStart(2, '0')
    return v
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function lightenHex(hex: string, dl = 12, ds = -5) {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex(h, s + ds, l + dl)
}

export function darkenHex(hex: string, dl = -12, ds = 3) {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex(h, s + ds, l + dl)
}
