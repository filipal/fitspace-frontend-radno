import { useEffect, useState, type CSSProperties } from 'react'

type SourceHint = {
  summary: string
  location: string
}

type Metric = {
  label: string
  value: string
  warn?: boolean
  sources?: SourceHint[]
}

const STORAGE_KEY = 'fsViewportOverlayEnabled'

const overlayBaseStyle: CSSProperties = {
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

const panelStyle: CSSProperties = {
  position: 'fixed',
  bottom: '12px',
  left: '12px',
  zIndex: 1000000,
  pointerEvents: 'auto',
  fontFamily: 'monospace',
  fontSize: '11px',
  lineHeight: 1.4,
  color: '#f5f5f5',
  backgroundColor: 'rgba(0,0,0,0.82)',
  padding: '10px',
  borderRadius: '6px',
  maxWidth: 'min(90vw, 420px)',
  maxHeight: 'min(70vh, 480px)',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  display: 'grid',
  gap: '6px',
}

const toggleButtonStyle: CSSProperties = {
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

const hideButtonStyle: CSSProperties = {
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

    const formatPx = (value: number | null | undefined) => {
      if (value == null || Number.isNaN(value)) {
        return '—'
      }

      const rounded = Math.round(value * 10) / 10
      const display = Number.isInteger(rounded)
        ? rounded.toFixed(0)
        : rounded.toFixed(1)
      return `${display}px`
    }

    const formatDelta = (value: number | null | undefined) => {
      if (value == null || Number.isNaN(value)) {
        return '—'
      }
      const rounded = Math.round(value * 10) / 10
      const sign = rounded > 0 ? '+' : ''
      const display = Number.isInteger(rounded)
        ? rounded.toFixed(0)
        : rounded.toFixed(1)
      return `${sign}${display} px`
    }

    const metricSourceHints: Record<string, SourceHint[]> = {
      'Δ page ↔︎ visible': [
        {
          summary: 'Layout wrapper (`.page`) dobiva visinu iz CSS varijable',
          location: 'src/components/ResponsivePage/ResponsivePage.module.scss:8-37',
        },
        {
          summary: 'Wrapper se montira u React komponenti',
          location: 'src/components/ResponsivePage/ResponsivePage.tsx:22-35',
        },
      ],
      'Δ var ↔︎ visible': [
        {
          summary: 'Početna vrijednost varijable definirana je globalno',
          location: 'src/index.css:55-97',
        },
        {
          summary: 'ResponsivePage dodatno prilagođava varijablu',
          location: 'src/components/ResponsivePage/ResponsivePage.module.scss:8-37',
        },
        {
          summary: 'Pojedine stranice (npr. AvatarInfo) mogu je pregaziti',
          location: 'src/pages/AvatarInfoPage.tsx:147-160',
        },
      ],
      'Δ app ↔︎ visible': [
        {
          summary: 'JavaScript overlay izračunava `--app-visible-height`',
          location: 'src/components/ViewportOverlay/ViewportOverlay.tsx:252-274',
        },
        {
          summary: 'Stranica koristi vrijednost kroz `.page` stil',
          location: 'src/pages/AvatarInfoPage.module.scss:4-20',
        },
      ],
      '--fs-viewport-height': [
        {
          summary: 'Root fallback na `100svh/100dvh`',
          location: 'src/index.css:55-97',
        },
        {
          summary: 'ResponsivePage kombinira vrijednost sa safe-area umetkom',
          location: 'src/components/ResponsivePage/ResponsivePage.module.scss:8-37',
        },
        {
          summary: 'AvatarInfoPage u `useMemo` postavlja vlastiti izračun',
          location: 'src/pages/AvatarInfoPage.tsx:147-160, 266-288',
        },
      ],
      '--app-visible-height': [
        {
          summary: 'Overlay zapisuje trenutačnu visinu visualViewporta',
          location: 'src/components/ViewportOverlay/ViewportOverlay.tsx:252-274',
        },
        {
          summary: 'Stranica koristi fallback u SCSS-u ako varijabla nedostaje',
          location: 'src/pages/AvatarInfoPage.module.scss:4-20',
        },
      ],
      '--fs-page-max-height': [
        {
          summary: 'Globalni `index.css` definira maksimalnu vrijednost',
          location: 'src/index.css:69-77',
        },
        {
          summary: 'ResponsivePage `.canvas` osigurava da layout prati taj maksimum',
          location: 'src/components/ResponsivePage/ResponsivePage.module.scss:60-80',
        },
        {
          summary: 'AvatarInfoPage računa vlastiti `--fs-page-max-height`',
          location: 'src/pages/AvatarInfoPage.tsx:153-158, 273-287',
        },
      ],
      '--fs-scale': [
        {
          summary: 'Osnovna vrijednost postavljena je u globalnom CSS-u',
          location: 'src/index.css:58-67',
        },
        {
          summary: 'AvatarInfoPage računa specifičan scale za mobilni layout',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
      ],
      '--fs-scale-height': [
        {
          summary: 'Globalni odnos visine i dizajna',
          location: 'src/index.css:62-66',
        },
        {
          summary: 'AvatarInfoPage računa `heightScaleSafe` za sadržaj',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
      ],
      '--fs-scale-height-content': [
        {
          summary: 'Specifični scale za sadržaj koji postavlja AvatarInfoPage',
          location: 'src/pages/AvatarInfoPage.tsx:257-286',
        },
      ],
      '--fs-header-scale': [
        {
          summary: 'Mobilni algoritam određuje koliko se zaglavlje može smanjiti',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
        {
          summary: 'Header primjenjuje scale kroz clamp()',
          location: 'src/components/Header/Header.module.scss:1-40',
        },
      ],
      '--fs-header-height': [
        {
          summary: 'Osnovna visina zaglavlja u mobilnom dizajnu',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
        {
          summary: 'Clamp visina zaglavlja definirana u SCSS-u',
          location: 'src/components/Header/Header.module.scss:18-45',
        },
      ],
      '--fs-header-height-physical': [
        {
          summary: 'AvatarInfoPage izvozí procijenjenu fizičku visinu zaglavlja',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
      ],
      'header rect': [
        {
          summary: 'Header komponenta pruža `data-fs-header` za mjerenje',
          location: 'src/components/Header/Header.tsx:17-40',
        },
        {
          summary: 'Stil zaglavlja definiran je ovdje',
          location: 'src/components/Header/Header.module.scss:1-120',
        },
      ],
      'Δ header ↔︎ design': [
        {
          summary: 'Razlika između izračunate i renderirane visine zaglavlja',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
        {
          summary: 'Provjeri clamp logiku u SCSS-u',
          location: 'src/components/Header/Header.module.scss:18-45',
        },
      ],
      'Δ header ↔︎ physical': [
        {
          summary: 'Procjena fizičke visine dolazi iz React izračuna',
          location: 'src/pages/AvatarInfoPage.tsx:230-286',
        },
      ],
      '--fs-canvas-height': [
        {
          summary: 'Globalni canvas u `index.css` ovisi o `--fs-scale`',
          location: 'src/index.css:69-72',
        },
        {
          summary: 'AvatarInfoPage računa visinu platna prema sadržaju',
          location: 'src/pages/AvatarInfoPage.tsx:267-286',
        },
      ],
      '--fs-design-height': [
        {
          summary: 'Default mobile design visina',
          location: 'src/index.css:44-53',
        },
        {
          summary: 'AvatarInfoPage po potrebi postavlja novu vrijednost',
          location: 'src/pages/AvatarInfoPage.tsx:147-159, 230-286',
        },
      ],
      '--fs-design-safe-height': [
        {
          summary: 'Sigurna visina u globalnom CSS-u',
          location: 'src/index.css:44-53',
        },
        {
          summary: 'AvatarInfoPage koristi vrijednost za segmentirano skaliranje',
          location: 'src/pages/AvatarInfoPage.tsx:147-159, 230-286',
        },
      ],
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

      const approxValue = Math.round(resolved * 10) / 10
      const approx = Number.isInteger(approxValue)
        ? `${approxValue.toFixed(0)} px`
        : `${approxValue.toFixed(1)} px`
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
      const fsPageMaxHeightRaw = computedPage.getPropertyValue('--fs-page-max-height')
      const fsScaleRaw = computedPage.getPropertyValue('--fs-scale')
      const fsScaleWidthRaw = computedPage.getPropertyValue('--fs-scale-width')
      const fsScaleHeightRaw = computedPage.getPropertyValue('--fs-scale-height')
      const fsScaleHeightContentRaw = computedPage.getPropertyValue('--fs-scale-height-content')
      const fsCanvasHeightRaw = computedPage.getPropertyValue('--fs-canvas-height')
      const fsDesignHeightRaw = computedPage.getPropertyValue('--fs-design-height')
      const fsDesignSafeHeightRaw = computedPage.getPropertyValue('--fs-design-safe-height')
      const fsHeaderScaleRaw = computedPage.getPropertyValue('--fs-header-scale')
      const fsHeaderHeightRaw = computedPage.getPropertyValue('--fs-header-height')
      const fsHeaderHeightPhysicalRaw = computedPage.getPropertyValue('--fs-header-height-physical')

      const headerElement =
        pageElement?.querySelector<HTMLElement>('[data-fs-header]') ??
        document.querySelector<HTMLElement>('[data-fs-header]') ??
        null
      const headerRect = headerElement?.getBoundingClientRect() ?? null

      const appVisibleHeightPx = resolveCssLength(appVisibleHeightRaw, root)
      const fsViewportHeightPx = resolveCssLength(fsViewportHeightRaw, pageElement ?? root)
      const fsPageMaxHeightPx = resolveCssLength(fsPageMaxHeightRaw, pageElement ?? root)
      const fsCanvasHeightPx = resolveCssLength(fsCanvasHeightRaw, pageElement ?? root)
      const fsDesignHeightPx = resolveCssLength(fsDesignHeightRaw, pageElement ?? root)
      const fsDesignSafeHeightPx = resolveCssLength(fsDesignSafeHeightRaw, pageElement ?? root)
      const fsHeaderHeightPx = resolveCssLength(fsHeaderHeightRaw, pageElement ?? root)
      const fsHeaderHeightPhysicalPx = resolveCssLength(
        fsHeaderHeightPhysicalRaw,
        pageElement ?? root,
      )
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
      const deltaVisibleVsDesign =
        fsDesignHeightPx != null ? fsDesignHeightPx - visibleHeight : null
      const deltaPageVsDesign =
        pageRect && fsDesignHeightPx != null
          ? pageRect.height - fsDesignHeightPx
          : null
      const deltaHeaderVsDesign =
        headerRect && fsHeaderHeightPx != null
          ? headerRect.height - fsHeaderHeightPx
          : null
      const deltaHeaderVsPhysical =
        headerRect && fsHeaderHeightPhysicalPx != null
          ? headerRect.height - fsHeaderHeightPhysicalPx
          : null

      const designDeltaExplainedByHeader =
        deltaVisibleVsDesign != null &&
        deltaPageVsDesign != null &&
        fsDesignSafeHeightPx != null &&
        Math.abs(fsDesignSafeHeightPx - visibleHeight) <= 2 &&
        Math.abs(deltaVisibleVsDesign + deltaPageVsDesign) <= 2

      const designDeltaValue = formatDelta(deltaVisibleVsDesign)
      const pageDesignDeltaValue = formatDelta(deltaPageVsDesign)

      const decoratedDesignDeltaValue =
        designDeltaExplainedByHeader && designDeltaValue !== '—'
          ? `${designDeltaValue} · content-only var`
          : designDeltaValue

      const decoratedPageDesignDeltaValue =
        designDeltaExplainedByHeader && pageDesignDeltaValue !== '—'
          ? `${pageDesignDeltaValue} · header allocation`
          : pageDesignDeltaValue

      const designDeltaWarn =
        deltaVisibleVsDesign != null &&
        Math.abs(deltaVisibleVsDesign) > 2 &&
        !designDeltaExplainedByHeader

      const pageDesignDeltaWarn =
        deltaPageVsDesign != null &&
        Math.abs(deltaPageVsDesign) > 2 &&
        !designDeltaExplainedByHeader

      const screen = window.screen

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
          label: 'screen (avail)',
          value:
            screen
              ? `${screen.availWidth ?? screen.width} × ${screen.availHeight ?? screen.height} px`
              : '∅',
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
          value: formatCssVarValue(fsPageMaxHeightRaw, fsPageMaxHeightPx),
        },
        {
          label: '--fs-scale',
          value: fsScaleRaw.trim() || '—',
        },
        {
          label: '--fs-scale-width',
          value: fsScaleWidthRaw.trim() || '—',
        },
        {
          label: '--fs-scale-height',
          value: fsScaleHeightRaw.trim() || '—',
        },
        {
          label: '--fs-scale-height-content',
          value: fsScaleHeightContentRaw.trim() || '—',
        },
        {
          label: '--fs-header-scale',
          value: fsHeaderScaleRaw.trim() || '—',
        },
        {
          label: '--fs-header-height',
          value: formatCssVarValue(fsHeaderHeightRaw, fsHeaderHeightPx),
        },
        {
          label: '--fs-header-height-physical',
          value: formatCssVarValue(fsHeaderHeightPhysicalRaw, fsHeaderHeightPhysicalPx),
        },
        {
          label: '--fs-canvas-height',
          value: formatCssVarValue(fsCanvasHeightRaw, fsCanvasHeightPx),
        },
        {
          label: '--fs-design-height',
          value: formatCssVarValue(fsDesignHeightRaw, fsDesignHeightPx),
        },
        {
          label: '--fs-design-safe-height',
          value: formatCssVarValue(fsDesignSafeHeightRaw, fsDesignSafeHeightPx),
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
        {
          label: 'Δ design ↔︎ visible',
          value: decoratedDesignDeltaValue,
          warn: designDeltaWarn,
        },
        {
          label: 'Δ page ↔︎ design',
          value: decoratedPageDesignDeltaValue,
          warn: pageDesignDeltaWarn,
        },
        {
          label: 'header rect',
          value: headerRect
            ? `${Math.round(headerRect.width)} × ${Math.round(headerRect.height)} px`
            : '∅',
          warn: headerRect == null,
        },
        {
          label: 'Δ header ↔︎ design',
          value: formatDelta(deltaHeaderVsDesign),
          warn:
            deltaHeaderVsDesign != null && Math.abs(deltaHeaderVsDesign) > 2,
        },
        {
          label: 'Δ header ↔︎ physical',
          value: formatDelta(deltaHeaderVsPhysical),
          warn:
            deltaHeaderVsPhysical != null && Math.abs(deltaHeaderVsPhysical) > 2,
        },
      ].map(metric => ({
        ...metric,
        sources: metricSourceHints[metric.label],
      })))
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
            pointerEvents: 'auto',
          }}
        >
          {metrics.map(metric => (
            <li
              key={metric.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'max-content minmax(0, 1fr)',
                alignItems: 'start',
                gap: '8px',
                color: metric.warn ? '#ffb74d' : undefined,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                pointerEvents: 'auto',
              }}
            >
              <span style={{ opacity: 0.75 }}>{metric.label}</span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'right',
                  display: 'block',
                }}
              >
                {metric.value}
              </span>
              {metric.warn && metric.sources?.length ? (
                <div
                  style={{
                    gridColumn: '1 / span 2',
                    display: 'grid',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#f5f5f5',
                    opacity: 0.9,
                    paddingLeft: '6px',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {metric.sources.map((source, index) => (
                    <div key={`${metric.label}-source-${index}`} style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 500 }}>{source.summary}</span>
                      <code
                        style={{
                          fontSize: '10px',
                          background: 'rgba(255,255,255,0.08)',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          width: 'fit-content',
                        }}
                      >
                        {source.location}
                      </code>
                    </div>
                  ))}
                </div>
              ) : null}
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