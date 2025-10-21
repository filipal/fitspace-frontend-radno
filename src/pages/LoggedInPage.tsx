import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import deleteIcon from '../assets/delete-avatar.svg'
import styles from './LoggedInPage.module.scss'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import { LAST_LOADED_AVATAR_STORAGE_KEY, useAvatarApi } from '../services/avatarApi'
import { useAvatars } from '../context/AvatarContext'
import ResponsivePage from '../components/ResponsivePage/ResponsivePage'

const USE_LOADING_ROUTE = import.meta.env.VITE_USE_LOADING_ROUTE === 'true';

const MOBILE_DESIGN_WIDTH = 430
const DESKTOP_DESIGN_WIDTH = 1440
const DESKTOP_BREAKPOINT = 768
const MAX_VISIBLE_AVATARS = 5

const MIN_DENSITY_SCALE = 0.75
const MIN_TOP_SCALE = 0.6
const MIN_SECTION_SCALE = 0.6
const MIN_LIST_GAP_SCALE = 0.65
const MIN_LIST_ITEM_SCALE = 0.88
const MIN_BOTTOM_SCALE = 0.6
const MOBILE_SAFE_VISIBLE_HEIGHT = 658

const MOBILE_METRICS = {
  headerToListGap: 24,
  sectionGap: 24,
  listGap: 21,
  listItemHeight: 40,
  footerOffset: 45,
  contentWidth: 320,
  iconSize: 40
} as const

const DESKTOP_METRICS = {
  headerToListGap: 64,
  sectionGap: 32,
  listGap: 20,
  listItemHeight: 42,
  footerOffset: 0,
  minListHeight: 280,
  headerHeight: 71,
  footerHeight: 155
} as const

interface ViewportSize {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type SegmentKey = 'top' | 'section' | 'listGap' | 'listItem' | 'bottom'

interface SegmentDefinition {
  key: SegmentKey
  base: number
  minScale: number
  shrinkWeight: number
}

interface SegmentState extends SegmentDefinition {
  scale: number
}

interface LayoutMetrics {
  designHeight: number
  topScale: number
  sectionScale: number
  listGapScale: number
  listItemScale: number
  bottomScale: number
}

const FLEXIBLE_SEGMENTS: readonly SegmentDefinition[] = [
  {
    key: 'top',
    base: MOBILE_METRICS.headerToListGap,
    minScale: MIN_TOP_SCALE,
    shrinkWeight: 0.9
  },
  {
    key: 'section',
    base: MOBILE_METRICS.sectionGap,
    minScale: MIN_SECTION_SCALE,
    shrinkWeight: 0.8
  },
  {
    key: 'listGap',
    base: MOBILE_METRICS.listGap * (MAX_VISIBLE_AVATARS - 1),
    minScale: MIN_LIST_GAP_SCALE,
    shrinkWeight: 1
  },
  {
    key: 'listItem',
    base: MOBILE_METRICS.listItemHeight * MAX_VISIBLE_AVATARS,
    minScale: MIN_LIST_ITEM_SCALE,
    shrinkWeight: 0.7
  },
  {
    key: 'bottom',
    base: MOBILE_METRICS.footerOffset,
    minScale: MIN_BOTTOM_SCALE,
    shrinkWeight: 0.85
  }
]

const FULL_FLEXIBLE_HEIGHT = FLEXIBLE_SEGMENTS.reduce((sum, segment) => sum + segment.base, 0)

const MIN_FLEXIBLE_HEIGHT = FLEXIBLE_SEGMENTS.reduce(
  (sum, segment) => sum + segment.base * segment.minScale,
  0
)

function computeLayoutMetrics(viewportHeight: number): LayoutMetrics {
  const targetFlexibleHeight = clamp(
    viewportHeight,
    MIN_FLEXIBLE_HEIGHT,
    FULL_FLEXIBLE_HEIGHT
  )

  const workingSegments: SegmentState[] = FLEXIBLE_SEGMENTS.map((segment) => ({
    ...segment,
    scale: 1
  }))

  let currentFlexibleHeight = FULL_FLEXIBLE_HEIGHT

  for (let iteration = 0; iteration < 6; iteration += 1) {
    if (currentFlexibleHeight <= targetFlexibleHeight + 0.01) {
      break
    }

    const shrinkable = workingSegments.filter(
      (segment) => segment.scale > segment.minScale + 0.0001
    )

    if (shrinkable.length === 0) {
      break
    }

    const totalWeightedCapacity = shrinkable.reduce((sum, segment) => {
      const capacity = (segment.scale - segment.minScale) * segment.base
      return sum + capacity * segment.shrinkWeight
    }, 0)

    if (totalWeightedCapacity <= 0) {
      break
    }

    const excess = currentFlexibleHeight - targetFlexibleHeight
    let consumedHeight = 0

    shrinkable.forEach((segment) => {
      const capacity = (segment.scale - segment.minScale) * segment.base
      if (capacity <= 0) {
        return
      }

      const weightedCapacity = capacity * segment.shrinkWeight
      const shrinkHeight = Math.min(
        capacity,
        (excess * weightedCapacity) / totalWeightedCapacity
      )

      if (shrinkHeight <= 0) {
        return
      }

      segment.scale -= shrinkHeight / segment.base
      consumedHeight += shrinkHeight
    })

    if (consumedHeight <= 0.001) {
      break
    }

    currentFlexibleHeight -= consumedHeight
  }

  let topScale = MIN_TOP_SCALE
  let sectionScale = MIN_SECTION_SCALE
  let listGapScale = MIN_LIST_GAP_SCALE
  let listItemScale = MIN_LIST_ITEM_SCALE
  let bottomScale = MIN_BOTTOM_SCALE
  let flexibleHeight = 0

  workingSegments.forEach((segment) => {
    const finalScale = clamp(segment.scale, segment.minScale, 1)
    flexibleHeight += segment.base * finalScale

    switch (segment.key) {
      case 'top':
        topScale = finalScale
        break
      case 'section':
        sectionScale = finalScale
        break
      case 'listGap':
        listGapScale = finalScale
        break
      case 'listItem':
        listItemScale = finalScale
        break
      case 'bottom':
        bottomScale = finalScale
        break
    }
  })

  return {
    designHeight: flexibleHeight,
    topScale,
    sectionScale,
    listGapScale,
    listItemScale,
    bottomScale
  }
}

type LoggedInPageCssVars = CSSProperties & {
  '--fs-design-width'?: string
  '--fs-design-height'?: string
  '--fs-design-safe-height'?: string
  '--fs-viewport-height'?: string
  '--fs-scale-width'?: string
  '--fs-scale-height'?: string
  '--fs-scale'?: string
  '--fs-canvas-width'?: string
  '--fs-canvas-height'?: string
  '--fs-page-max-height'?: string
  '--loggedin-top-gap'?: string
  '--loggedin-bottom-gap'?: string
  '--loggedin-section-gap'?: string
  '--loggedin-content-width'?: string
  '--loggedin-list-gap'?: string
  '--loggedin-list-item-height'?: string
  '--loggedin-list-max-height'?: string
  '--loggedin-icon-size'?: string
  '--loggedin-font-scale'?: string
  '--loggedin-footer-button-height'?: string
  '--loggedin-inline-padding'?: string
}

function readViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: MOBILE_DESIGN_WIDTH, height: MOBILE_SAFE_VISIBLE_HEIGHT }
  }

  const viewport = window.visualViewport
  if (viewport) {
    return { width: viewport.width, height: viewport.height }
  }

  return { width: window.innerWidth, height: window.innerHeight }
}

export default function LoggedInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loadAvatar, loaderState } = useAvatarLoader()
  const { fetchAvatarById, deleteAvatar } = useAvatarApi()
  const { avatars, refreshAvatars, maxAvatars } = useAvatars()
  const locationState = location.state as { nextRoute?: string } | null

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [loadedAvatarId, setLoadedAvatarId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  })

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ▼ Inline confirmation state (umjesto window.confirm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [confirmPos, setConfirmPos] = useState<
    { top: number; height: number; left: number; width: number } | null
  >(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [viewportSize, setViewportSize] = useState<ViewportSize>(() => readViewportSize())
  const { width: viewportWidth, height: viewportHeight } = viewportSize
  const loadButtonRef = useRef<HTMLButtonElement | null>(null)

  // 1) Na mount: očisti “zadnje učitan” i lokalni state
  useEffect(() => {
    try {
      sessionStorage.removeItem(LAST_LOADED_AVATAR_STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear last loaded avatar key', error)
    }
    setLoadedAvatarId(null)
    setSelectedAvatarId(null)
  }, [])

  // 2) Ako nema avatara u memoriji konteksta, dovuci listu
  useEffect(() => {
    if (avatars.length > 0) return
    refreshAvatars().catch(err => 
      console.error('Failed to refresh avatars', err))
  }, [avatars.length, refreshAvatars])

  // 3) Sinkronizacija selekcije s listom BEZ auto-odabira
  useEffect(() => {
    setSelectedAvatarId(prev =>
      prev && avatars.some(a => a.id === prev) ? prev : null
    )
  }, [avatars])

  const handleSelect = (id: string) => setSelectedAvatarId(id)

  useEffect(() => {
    const handleResize = () => {
      setViewportSize(readViewportSize())
    }

    window.addEventListener('resize', handleResize)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      viewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  // NOVO
  const handleLoad = useCallback(async () => {
    if (!selectedAvatarId || loaderState.isLoading) return;

    const targetRoute = locationState?.nextRoute ?? '/virtual-try-on';

    // 1) Loading-route grana: ništa ne fetchamo/loada-mo ovdje.
    if (USE_LOADING_ROUTE) {
      try {
        setFetchError(null);
        // Loading page može sama dovući sve na temelju ID-a (ili spremi cijeli objekt ako tako očekuje)
        localStorage.setItem('pendingAvatarId', selectedAvatarId);
        navigate(`/loading?destination=${encodeURIComponent(targetRoute)}`, {
          state: { avatarId: selectedAvatarId },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to init loading flow';
        setFetchError(msg);
        console.error('Init loading flow failed', e);
      }
      return; // važno: prekini jer Loading preuzima dalje
    }

    // 2) Default (postojeći flow): fetch + load + navigate
    try {
      setFetchError(null);
      const avatarData = await fetchAvatarById(selectedAvatarId);
      const result = await loadAvatar(avatarData);
      if (!result.success) throw new Error(result.error ?? 'Failed to load avatar configuration');

      setLoadedAvatarId(selectedAvatarId);
      sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, selectedAvatarId);
      navigate(targetRoute, { state: { avatarId: selectedAvatarId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load avatar';
      setFetchError(msg);
      console.error('Failed to load avatar', e);
    }
  }, [selectedAvatarId, loaderState.isLoading, locationState?.nextRoute, fetchAvatarById, loadAvatar, navigate]);

  // ▼ Klik na “X” – prikaži inline potvrdu
  const handleDeleteClick = useCallback((id: string) => {
    setDeleteError(null)
    setShowDeleteConfirm(id)
  }, [])

  // ▼ Pozicioniraj crvenu traku iznad footer gumbića (koristi ref)
  const positionConfirm = useCallback(() => {
    const rect = loadButtonRef.current?.getBoundingClientRect()
    if (!rect) return
    setConfirmPos({
      top: rect.top,
      height: rect.height,
      left: rect.left,
      width: rect.width
    })
  }, [])
  useEffect(() => {
    if (!showDeleteConfirm) {
      setConfirmPos(null)
      return
    }
    positionConfirm()
    window.addEventListener('resize', positionConfirm)
    window.addEventListener('scroll', positionConfirm)
    return () => {
      window.removeEventListener('resize', positionConfirm)
      window.removeEventListener('scroll', positionConfirm)
    }
  }, [showDeleteConfirm, positionConfirm])

  // ▼ Potvrdi brisanje
  const confirmDelete = useCallback(async () => {
    if (!showDeleteConfirm || deletingId) return
    try {
      setDeletingId(showDeleteConfirm)
      await deleteAvatar(showDeleteConfirm)

      // reset selection/loaded ako brišemo aktivni
      setSelectedAvatarId(prev => (prev === showDeleteConfirm ? null : prev))
      setLoadedAvatarId(prev => {
        if (prev === showDeleteConfirm) {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(LAST_LOADED_AVATAR_STORAGE_KEY)
          }
          return null
        }
        return prev
      })

      await refreshAvatars()
      setShowDeleteConfirm(null)
      setConfirmPos(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete avatar'
      setDeleteError(msg)
      console.error('Delete failed:', e)
    } finally {
      setDeletingId(null)
    }
  }, [showDeleteConfirm, deletingId, deleteAvatar, refreshAvatars])

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(null)
    setConfirmPos(null)
  }, [])

  const loaderMessage = useMemo(() => {
    if (!loaderState.isLoading) return null
    switch (loaderState.stage) {
      case 'validation': return 'Validating avatar data…'
      case 'transformation': return 'Preparing avatar morphs…'
      case 'command_generation': return 'Generating avatar commands…'
      case 'unreal_communication': return 'Sending avatar to Unreal Engine…'
      case 'complete': return 'Avatar ready!'
      default: return 'Loading avatar…'
    }
  }, [loaderState.isLoading, loaderState.stage])

  const { cssVars: layoutVars, canvasHeight } = useMemo(() => {
    if (viewportWidth >= DESKTOP_BREAKPOINT) {
      const designWidth = Math.min(DESKTOP_DESIGN_WIDTH, viewportWidth)
      const visibleAvatarCount = Math.min(
        Math.max(avatars.length, 1),
        MAX_VISIBLE_AVATARS
      )
      const listHeight = Math.max(
        DESKTOP_METRICS.listItemHeight * visibleAvatarCount +
          DESKTOP_METRICS.listGap * Math.max(visibleAvatarCount - 1, 0),
        DESKTOP_METRICS.minListHeight
      )
      const hasLoaderBanner = loaderState.isLoading
      const hasErrorBanner = Boolean(
        loaderState.error || fetchError || deleteError
      )
      const dynamicSectionCount =
        1 + (hasLoaderBanner ? 1 : 0) + (hasErrorBanner ? 1 : 0)
      const dynamicSectionGap =
        dynamicSectionCount > 1
          ? DESKTOP_METRICS.sectionGap * (dynamicSectionCount - 1)
          : 0
      const loaderBannerHeight = hasLoaderBanner ? 48 : 0
      const errorBannerHeight = hasErrorBanner ? 48 : 0
      const designHeight =
        DESKTOP_METRICS.headerToListGap +
        listHeight +
        dynamicSectionGap +
        loaderBannerHeight +
        errorBannerHeight +
        DESKTOP_METRICS.footerOffset
      const scaleWidth = clamp(
        viewportWidth / (designWidth || 1),
        0,
        Number.POSITIVE_INFINITY
      )

      const scaleHeight = clamp(
        viewportHeight / (designHeight || 1),
        0,
        Number.POSITIVE_INFINITY
      )

      const cssVars: LoggedInPageCssVars = {
        '--fs-design-width': `${designWidth}px`,
        '--fs-design-height': `${designHeight}px`,
        '--fs-design-safe-height': `${designHeight}px`,
        '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
        '--fs-scale-width': scaleWidth.toFixed(5),
        '--fs-scale-height': scaleHeight.toFixed(5),
        '--fs-scale': '1',
        '--fs-canvas-width': `${designWidth.toFixed(3)}px`,
        '--fs-canvas-height': `${designHeight.toFixed(3)}px`,
        '--fs-page-max-height': `${Math.max(designHeight, viewportHeight).toFixed(3)}px`
      }

      const totalPageHeight =
        designHeight + DESKTOP_METRICS.headerHeight + DESKTOP_METRICS.footerHeight

      return { cssVars, canvasHeight: totalPageHeight }
    }

    const {
      designHeight,
      topScale,
      sectionScale,
      listGapScale,
      listItemScale,
      bottomScale
    } = computeLayoutMetrics(viewportHeight)

    const density = clamp(
      viewportHeight / MOBILE_SAFE_VISIBLE_HEIGHT,
      MIN_DENSITY_SCALE,
      1
    )

    const listItemHeight = MOBILE_METRICS.listItemHeight * listItemScale
    const listGap = MOBILE_METRICS.listGap * listGapScale
    const listMaxHeight =
      listItemHeight * MAX_VISIBLE_AVATARS + listGap * (MAX_VISIBLE_AVATARS - 1)
    const iconSize = MOBILE_METRICS.iconSize * listItemScale

    const scaleWidth = clamp(
      viewportWidth / (MOBILE_DESIGN_WIDTH || 1),
      0,
      Number.POSITIVE_INFINITY
    )

    const scaleHeight = designHeight > 0
      ? clamp(viewportHeight / designHeight, 0, Number.POSITIVE_INFINITY)
      : 1

    const viewportScale = Math.min(scaleWidth, scaleHeight, 1)
    const canvasWidth = MOBILE_DESIGN_WIDTH * viewportScale
    const canvasHeight = designHeight * viewportScale
    const pageMaxHeight = Math.min(canvasHeight, viewportHeight)

    const footerButtonHeight = 50 * bottomScale

    const cssVars: LoggedInPageCssVars = {
      '--fs-design-width': `${MOBILE_DESIGN_WIDTH}px`,
      '--fs-design-height': `${designHeight.toFixed(3)}px`,
      '--fs-design-safe-height': `${designHeight.toFixed(3)}px`,
      '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
      '--fs-scale-width': scaleWidth.toFixed(5),
      '--fs-scale-height': scaleHeight.toFixed(5),
      '--fs-scale': viewportScale.toFixed(5),
      '--fs-canvas-width': `${canvasWidth.toFixed(3)}px`,
      '--fs-canvas-height': `${canvasHeight.toFixed(3)}px`,
      '--fs-page-max-height': `${pageMaxHeight.toFixed(3)}px`,
      '--loggedin-top-gap': `${(MOBILE_METRICS.headerToListGap * topScale).toFixed(3)}px`,
      '--loggedin-bottom-gap': `${(MOBILE_METRICS.footerOffset * bottomScale).toFixed(3)}px`,
      '--loggedin-section-gap': `${(MOBILE_METRICS.sectionGap * sectionScale).toFixed(3)}px`,
      '--loggedin-content-width': `${MOBILE_METRICS.contentWidth}px`,
      '--loggedin-list-gap': `${listGap.toFixed(3)}px`,
      '--loggedin-list-item-height': `${listItemHeight.toFixed(3)}px`,
      '--loggedin-list-max-height': `${listMaxHeight.toFixed(3)}px`,
      '--loggedin-icon-size': `${iconSize.toFixed(3)}px`,
      '--loggedin-font-scale': density.toFixed(3),
      '--loggedin-footer-button-height': `${footerButtonHeight.toFixed(3)}px`,
      '--loggedin-inline-padding': '0px'
    }

    return { cssVars, canvasHeight }
  }, [
    viewportHeight,
    viewportWidth,
    avatars.length,
    loaderState.error,
    loaderState.isLoading,
    fetchError,
    deleteError
  ])

  const needsScroll = canvasHeight > viewportHeight + 0.5
  const pageClassName = needsScroll
    ? `${styles.page} ${styles.pageScrollable}`
    : styles.page

  return (
    <ResponsivePage
      style={layoutVars}
      className={pageClassName}
      bodyClassName={styles.body}
      contentClassName={styles.canvasInner}
      header={
        <Header
          title="Welcome back!"
          variant="dark"
          onExit={() => navigate('/')}
          rightContent={
            <span className={styles.count}>
              {avatars.length}/{maxAvatars}
            </span>
          }
        />
      }
      footer={
        <>
          {showDeleteConfirm && confirmPos && (
            <div
              className={styles.deleteConfirmOverlay}
              style={{
                top: confirmPos.top,
                height: confirmPos.height,
                left: confirmPos.left,
                width: confirmPos.width
              }}
            >
              <div className={styles.deleteConfirmRow}>Are you sure?</div>
            </div>
          )}
          <Footer
            className={styles.footer}
            topButtonText="Load Avatar"
            onTopButton={handleLoad}
            topButtonDisabled={
              selectedAvatarId === null ||
              selectedAvatarId === loadedAvatarId ||
              loaderState.isLoading ||
              Boolean(showDeleteConfirm)
            }
            topButtonType="primary"
            backText={showDeleteConfirm ? 'Cancel' : 'Back'}
            actionText={
              showDeleteConfirm
                ? deletingId
                  ? 'Deleting…'
                  : 'Delete Avatar'
                : 'Create New Avatar'
            }
            onBack={() =>
              showDeleteConfirm
                ? cancelDelete()
                : navigate('/login', {
                    replace: true,
                    state: { allowAuthenticated: true }
                  })
            }
            onAction={() =>
              showDeleteConfirm ? confirmDelete() : navigate('/avatar-info')
            }
            actionDisabled={
              showDeleteConfirm ? Boolean(deletingId) : avatars.length >= maxAvatars
            }
            actionType={showDeleteConfirm ? 'black' : 'black'}
            loadButtonRef={loadButtonRef}
          />
        </>
      }
    >
      <div className={styles.content}>
        <div className={styles.listArea}>
          <ul className={styles.avatarList}>
            {avatars.map((avatar) => {
              const isDeleting = deletingId === avatar.id
              const isConfirmingThis = showDeleteConfirm === avatar.id
              return (
                <li key={avatar.id} className={styles.avatarItem}>
                  <button
                    className={`${styles.avatarName}${
                      selectedAvatarId === avatar.id ? ' ' + styles.selected : ''
                    }`}
                    onClick={() => handleSelect(avatar.id)}
                    type="button"
                    disabled={Boolean(showDeleteConfirm)}
                  >
                    {avatar.name}
                  </button>
                  <button
                    className={styles.iconButton}
                    aria-label="remove avatar"
                    type="button"
                    onClick={() => handleDeleteClick(avatar.id)}
                    disabled={loaderState.isLoading || Boolean(deletingId)}
                    title={
                      isDeleting
                        ? 'Deleting…'
                        : isConfirmingThis
                        ? 'Confirm below'
                        : 'Remove avatar'
                    }
                  >
                    <img src={deleteIcon} alt="Delete Avatar" />
                  </button>
                </li>
              )
            })}
          </ul>

          {loaderState.isLoading && (
            <div className={styles.loaderBanner}>
              <span>{loaderMessage}</span>
              {typeof loaderState.progress === 'number' && (
                <span className={styles.loaderProgress}>
                  {` ${Math.round(loaderState.progress)}%`}
                </span>
              )}
            </div>
          )}

          {(loaderState.error || fetchError || deleteError) && (
            <div className={styles.errorBanner}>
              {loaderState.error ?? fetchError ?? deleteError}
            </div>
          )}
        </div>
      </div>
    </ResponsivePage>
  )
}