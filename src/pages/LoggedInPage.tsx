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
const MOBILE_DESIGN_HEIGHT = 932
const DESKTOP_DESIGN_WIDTH = 1440
const DESKTOP_DESIGN_HEIGHT = 1024
const DESKTOP_BREAKPOINT = 768
const MAX_VISIBLE_AVATARS = 5

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
  headerToListGap: 48,
  sectionGap: 32,
  listGap: 18,
  listItemHeight: 42,
  footerOffset: 96,
  narrowContentWidth: 422,
  wideContentWidth: 480,
  iconSize: 50
} as const

interface ViewportSize {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type LoggedInPageCssVars = CSSProperties & {
  '--fs-design-width'?: string
  '--fs-design-height'?: string
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
}

function readViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: MOBILE_DESIGN_WIDTH, height: MOBILE_DESIGN_HEIGHT }
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
      const designHeight = DESKTOP_DESIGN_HEIGHT
      const isWide = viewportWidth >= 1280
      const contentWidth = isWide
        ? DESKTOP_METRICS.wideContentWidth
        : DESKTOP_METRICS.narrowContentWidth
      const listMaxHeight =
        DESKTOP_METRICS.listItemHeight * MAX_VISIBLE_AVATARS +
        DESKTOP_METRICS.listGap * (MAX_VISIBLE_AVATARS - 1)
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
        '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
        '--fs-scale-width': scaleWidth.toFixed(5),
        '--fs-scale-height': scaleHeight.toFixed(5),
        '--fs-scale': '1',
        '--fs-canvas-width': `${designWidth.toFixed(3)}px`,
        '--fs-canvas-height': `${designHeight.toFixed(3)}px`,
        '--fs-page-max-height': `${Math.max(designHeight, viewportHeight).toFixed(3)}px`,
        '--loggedin-top-gap': `${DESKTOP_METRICS.headerToListGap}px`,
        '--loggedin-bottom-gap': `${DESKTOP_METRICS.footerOffset}px`,
        '--loggedin-section-gap': `${DESKTOP_METRICS.sectionGap}px`,
        '--loggedin-content-width': `${contentWidth}px`,
        '--loggedin-list-gap': `${DESKTOP_METRICS.listGap}px`,
        '--loggedin-list-item-height': `${DESKTOP_METRICS.listItemHeight}px`,
        '--loggedin-list-max-height': `${listMaxHeight}px`,
        '--loggedin-icon-size': `${DESKTOP_METRICS.iconSize}px`
      }

      return { cssVars, canvasHeight: designHeight }
    }

    const scaleWidth = clamp(
      viewportWidth / (MOBILE_DESIGN_WIDTH || 1),
      0,
      Number.POSITIVE_INFINITY
    )

    const scaleHeight = clamp(
      viewportHeight / (MOBILE_DESIGN_HEIGHT || 1),
      0,
      Number.POSITIVE_INFINITY
    )

    const viewportScale = Math.min(scaleWidth, scaleHeight, 1)
    const canvasWidth = MOBILE_DESIGN_WIDTH * viewportScale
    const canvasHeight = MOBILE_DESIGN_HEIGHT * viewportScale
    const listMaxHeight =
      MOBILE_METRICS.listItemHeight * MAX_VISIBLE_AVATARS +
      MOBILE_METRICS.listGap * (MAX_VISIBLE_AVATARS - 1)

    const cssVars: LoggedInPageCssVars = {
      '--fs-design-width': `${MOBILE_DESIGN_WIDTH}px`,
      '--fs-design-height': `${MOBILE_DESIGN_HEIGHT}px`,
      '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
      '--fs-scale-width': scaleWidth.toFixed(5),
      '--fs-scale-height': scaleHeight.toFixed(5),
      '--fs-scale': viewportScale.toFixed(5),
      '--fs-canvas-width': `${canvasWidth.toFixed(3)}px`,
      '--fs-canvas-height': `${canvasHeight.toFixed(3)}px`,
      '--fs-page-max-height': `${Math.max(canvasHeight, viewportHeight).toFixed(3)}px`,
      '--loggedin-top-gap': `${MOBILE_METRICS.headerToListGap}px`,
      '--loggedin-bottom-gap': `${MOBILE_METRICS.footerOffset}px`,
      '--loggedin-section-gap': `${MOBILE_METRICS.sectionGap}px`,
      '--loggedin-content-width': `${MOBILE_METRICS.contentWidth}px`,
      '--loggedin-list-gap': `${MOBILE_METRICS.listGap}px`,
      '--loggedin-list-item-height': `${MOBILE_METRICS.listItemHeight}px`,
      '--loggedin-list-max-height': `${listMaxHeight}px`,
      '--loggedin-icon-size': `${MOBILE_METRICS.iconSize}px`
    }

    return { cssVars, canvasHeight }
  }, [viewportHeight, viewportWidth])

  const needsScroll =
    viewportWidth >= DESKTOP_BREAKPOINT || canvasHeight > viewportHeight + 0.5
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