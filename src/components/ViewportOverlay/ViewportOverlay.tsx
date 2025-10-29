import { useEffect, useState } from 'react'

type Metric = {
  label: string
  value: string
  warn?: boolean
}

const STORAGE_KEY = 'fsViewportOverlayEnabled'

const overlayBaseStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  width: '0px',
  height: '0px',
  border: '2px solid red',
  boxSizing: 'border-box',
  pointerEvents: 'none', // ne blokira klikove
  zIndex: 999999, // iznad appa, ispod devtools
  backgroundColor: 'rgba(255,0,0,0.05)',
  color: 'red',
  fontFamily: 'monospace',
  fontSize: '11px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: '4px',
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '12px',
  left: '12px',
  zIndex: 1000000,
  pointerEvents: 'none',
  fontFamily: 'monospace',
  fontSize: '11px',
  lineHeight: 1.4,
  color: '#f5f5f5',
  backgroundColor: 'rgba(0,0,0,0.82)',
  padding: '10px',
  borderRadius: '6px',
  maxWidth: 'min(90vw, 420px)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  display: 'grid',
  gap: '6px',
}

const toggleButtonStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '12px',
  left: '12px',
  zIndex: 1000000,
  fontFamily: 'monospace',
  fontSize: '11px',
  letterSpacing: '0.04em',
  padding: '6px 10px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.35)',
  backgroundColor: 'rgba(0,0,0,0.8)',
  color: '#f5f5f5',
  cursor: 'pointer',
}

const hideButtonStyle: React.CSSProperties = {
  position: 'fixed',
  top: '12px',
  right: '12px',
  zIndex: 1000000,
  fontFamily: 'monospace',
  fontSize: '11px',
  letterSpacing: '0.04em',
  padding: '6px 10px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.35)',
  backgroundColor: 'rgba(0,0,0,0.8)',
  color: '#f5f5f5',
  cursor: 'pointer',
  pointerEvents: 'auto',
}

export function ViewportOverlay() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY)
      return stored !== 'false'
    } catch (error) {
      console.warn('ViewportOverlay: cannot access sessionStorage', error)
      return true
    }
  })
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties>(overlayBaseStyle)
  const [label, setLabel] = useState('…')
  const [metrics, setMetrics] = useState<Metric[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'v' && event.ctrlKey && event.shiftKey) {
        event.preventDefault()
        setEnabled(value => !value)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(enabled))
    } catch (error) {
      console.warn('ViewportOverlay: cannot persist session state', error)
    }

    if (!enabled) {
      const root = document.documentElement
      root.style.removeProperty('--app-visible-height')
      root.style.removeProperty('--app-visible-width')
      root.style.removeProperty('--app-visible-offset-top')
      root.style.removeProperty('--app-visible-offset-left')
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const formatPx = (value: number | null | undefined) =>
      value == null ? '—' : `${Math.round(value)}px`

    const formatDelta = (value: number | null | undefined) => {
      if (value == null || Number.isNaN(value)) {
        return '—'
      }
      const rounded = Math.round(value)
      const sign = rounded > 0 ? '+' : ''
      return `${sign}${rounded} px`
    }

    let measurementProbe: HTMLDivElement | null = null
    let measurementContext: HTMLElement | null = null

    const ensureProbe = (context?: HTMLElement | null) => {
      let desiredParent = context ?? measurementContext ?? document.querySelector<HTMLElement>('[data-fs-responsive-page]')
        ?? document.body ?? document.documentElement

      if (desiredParent === document.documentElement && document.body) {
        desiredParent = document.body
      }

      if (!desiredParent) {
        return null
      }

      if (
        measurementProbe &&
        measurementProbe.isConnected &&
        measurementContext === desiredParent
      ) {
        return measurementProbe
      }

      if (measurementProbe?.parentNode) {
        measurementProbe.parentNode.removeChild(measurementProbe)
      }

      const probe = document.createElement('div')
      probe.setAttribute('data-viewport-overlay-probe', 'true')
      probe.style.position = 'absolute'
      probe.style.visibility = 'hidden'
      probe.style.pointerEvents = 'none'
      probe.style.border = '0'
      probe.style.padding = '0'
      probe.style.margin = '0'
      probe.style.width = '0'
      probe.style.setProperty('inline-size', '0')
      probe.style.left = '0'
      probe.style.top = '0'

      desiredParent.appendChild(probe)
      measurementProbe = probe
      measurementContext = desiredParent
      return probe
    }

    const resolveCssLength = (input: string, context?: HTMLElement | null): number | null => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null
      }

      const trimmed = input.trim()
      if (!trimmed) {
        return null
      }

      const simplePxMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/)
      if (simplePxMatch) {
        const numeric = Number.parseFloat(simplePxMatch[1])
        return Number.isFinite(numeric) ? numeric : null
      }

      const unitlessMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/)
      if (unitlessMatch) {
        const numeric = Number.parseFloat(unitlessMatch[1])
        return Number.isFinite(numeric) ? numeric : null
      }

      const probe = ensureProbe(context)
      if (!probe) {
        return null
      }

      probe.style.height = trimmed
      probe.style.setProperty('block-size', trimmed)
      const rect = probe.getBoundingClientRect()

      const value = rect.height
      return Number.isFinite(value) ? value : null
    }

    const formatCssVarValue = (raw: string, resolved: number | null) => {
      const trimmed = raw.trim()
      if (!trimmed) {
        return '—'
      }

      if (resolved == null || Number.isNaN(resolved)) {
        return trimmed
      }

      const approx = `${Math.round(resolved)} px`
      if (/^-?\d+(?:\.\d+)?px$/.test(trimmed)) {
        return approx
      }

      return `${trimmed} ≈ ${approx}`
    }

    let rafId = 0

    const applyUpdate = () => {
      const vv = window.visualViewport
      const visibleHeight = vv?.height ?? window.innerHeight
      const visibleWidth = vv?.width ?? window.innerWidth
      const offsetLeft = vv?.offsetLeft ?? 0
      const offsetTop = vv?.offsetTop ?? 0

      // stil boxa (kutija koja crta “stvarno vidljivo”)
      setBoxStyle(prev => ({
        ...prev,
        width: visibleWidth + 'px',
        height: visibleHeight + 'px',
        left: offsetLeft + 'px',
        top: offsetTop + 'px',
      }))

      // labela u kutu
      setLabel(
        `visible ${Math.round(visibleWidth)}×${Math.round(
          visibleHeight
        )} px @ dpr ${window.devicePixelRatio}`
      )

      // BONUS: CSS varijable za layout (možeš koristiti u SCSS-u)
      const root = document.documentElement
      root.style.setProperty('--app-visible-height', visibleHeight + 'px')
      root.style.setProperty('--app-visible-width', visibleWidth + 'px')
      root.style.setProperty('--app-visible-offset-top', offsetTop + 'px')
      root.style.setProperty('--app-visible-offset-left', offsetLeft + 'px')

      const pageElement = document.querySelector<HTMLElement>(
        '[data-fs-responsive-page]'
      )
      const computedRoot = getComputedStyle(root)
      const computedPage = pageElement ? getComputedStyle(pageElement) : computedRoot

      const appVisibleHeightRaw = computedRoot.getPropertyValue('--app-visible-height')
      const fsViewportHeightRaw = computedPage.getPropertyValue('--fs-viewport-height')
      const fsPageMaxHeight = computedPage.getPropertyValue('--fs-page-max-height').trim()
      const fsScale = computedPage.getPropertyValue('--fs-scale').trim()
      const fsCanvasHeight = computedPage.getPropertyValue('--fs-canvas-height').trim()
      const fsDesignHeight = computedPage.getPropertyValue('--fs-design-height').trim()

      const appVisibleHeightPx = resolveCssLength(appVisibleHeightRaw, root)
      const fsViewportHeightPx = resolveCssLength(fsViewportHeightRaw, pageElement ?? root)
      const pageRect = pageElement?.getBoundingClientRect() ?? null

      const pageScrollHeight = pageElement?.scrollHeight ?? null
      const doc = document.documentElement
      const body = document.body

      const deltaVisibleVsPage =
        pageRect == null ? null : pageRect.height - visibleHeight
      const deltaVisibleVsVar =
        fsViewportHeightPx != null
          ? fsViewportHeightPx - visibleHeight
          : null
      const deltaVisibleVsApp =
        appVisibleHeightPx != null ? appVisibleHeightPx - visibleHeight : null

      setMetrics([
        {
          label: 'visualViewport',
          value: `${Math.round(visibleWidth)} × ${Math.round(visibleHeight)} px`,
        },
        {
          label: 'vv offset',
          value: `top ${Math.round(offsetTop)} px, left ${Math.round(offsetLeft)} px`,
          warn: offsetTop > 0 || offsetLeft > 0,
        },
        {
          label: 'window.inner',
          value: `${Math.round(window.innerWidth)} × ${Math.round(window.innerHeight)} px`,
        },
        {
          label: 'window.scrollY',
          value: formatPx(window.scrollY),
          warn: window.scrollY > 0,
        },
        {
          label: 'documentElement.clientHeight',
          value: formatPx(doc.clientHeight),
        },
        {
          label: 'documentElement.scrollHeight',
          value: formatPx(doc.scrollHeight),
        },
        {
          label: 'body.scrollHeight',
          value: formatPx(body?.scrollHeight ?? null),
        },
        {
          label: '--fs-viewport-height',
          value: formatCssVarValue(fsViewportHeightRaw, fsViewportHeightPx),
          warn:
            fsViewportHeightPx != null &&
            Math.abs(fsViewportHeightPx - visibleHeight) > 2,
        },
        {
          label: '--app-visible-height',
          value: formatCssVarValue(appVisibleHeightRaw, appVisibleHeightPx),
          warn:
            appVisibleHeightPx != null &&
            Math.abs(appVisibleHeightPx - visibleHeight) > 2,
        },
        {
          label: '--fs-page-max-height',
          value: fsPageMaxHeight || '—',
        },
        {
          label: '--fs-scale',
          value: fsScale || '—',
        },
        {
          label: '--fs-canvas-height',
          value: fsCanvasHeight || '—',
        },
        {
          label: '--fs-design-height',
          value: fsDesignHeight || '—',
        },
        {
          label: 'page rect',
          value: pageRect
            ? `${Math.round(pageRect.width)} × ${Math.round(pageRect.height)} px`
            : '∅',
          warn: pageRect == null,
        },
        {
          label: 'page.offsetTop',
          value: pageRect ? formatPx(pageRect.top + window.scrollY) : '—',
        },
        {
          label: 'page.scrollHeight',
          value: formatPx(pageScrollHeight),
        },
        {
          label: 'Δ page ↔︎ visible',
          value: formatDelta(deltaVisibleVsPage),
          warn:
            deltaVisibleVsPage != null && Math.abs(deltaVisibleVsPage) > 2,
        },
        {
          label: 'Δ var ↔︎ visible',
          value: formatDelta(deltaVisibleVsVar),
          warn:
            deltaVisibleVsVar != null && Math.abs(deltaVisibleVsVar) > 2,
        },
        {
          label: 'Δ app ↔︎ visible',
          value: formatDelta(deltaVisibleVsApp),
          warn:
            deltaVisibleVsApp != null && Math.abs(deltaVisibleVsApp) > 2,
        },
      ])
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(applyUpdate)
    }

    scheduleUpdate()

    window.addEventListener('resize', scheduleUpdate, { passive: true })
    window.addEventListener('scroll', scheduleUpdate, { passive: true })

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', scheduleUpdate, { passive: true })
      vv.addEventListener('scroll', scheduleUpdate, { passive: true })
    }

    let pageObserver: ResizeObserver | undefined
    if ('ResizeObserver' in window) {
      const pageElement = document.querySelector('[data-fs-responsive-page]')
      if (pageElement) {
        pageObserver = new ResizeObserver(() => scheduleUpdate())
        pageObserver.observe(pageElement)
      }
    }

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate)
      if (vv) {
        vv.removeEventListener('resize', scheduleUpdate)
        vv.removeEventListener('scroll', scheduleUpdate)
      }
      pageObserver?.disconnect()
      if (measurementProbe?.parentNode) {
        measurementProbe.parentNode.removeChild(measurementProbe)
      }
      measurementProbe = null
      measurementContext = null
    }
  }, [enabled])

  if (!enabled) {
    return (
      <button
        type="button"
        style={toggleButtonStyle}
        onClick={() => setEnabled(true)}
        title="Show viewport overlay (Ctrl+Shift+V)"
      >
         viewport overlay: hidden (Ctrl+Shift+V)
      </button>
    )
  }

  return (
    <>
      <div style={boxStyle}>
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '2px 4px',
            borderRadius: '3px',
            fontSize: '10px',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      </div>

      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>
            viewport debug
          </span>
        </div>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '3px',
            pointerEvents: 'none',
          }}
        >
          {metrics.map(metric => (
            <li
              key={metric.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                color: metric.warn ? '#ffb74d' : undefined,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              <span style={{ opacity: 0.75 }}>{metric.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {metric.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        style={hideButtonStyle}
        onClick={() => setEnabled(false)}
        title="Hide viewport overlay (Ctrl+Shift+V)"
      >
        sakrij overlay (Ctrl+Shift+V)
      </button>
    </>
  )
}