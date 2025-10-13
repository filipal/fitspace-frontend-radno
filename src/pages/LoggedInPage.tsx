import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import deleteIcon from '../assets/delete-avatar.svg'
import styles from './LoggedInPage.module.scss'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import { LAST_LOADED_AVATAR_STORAGE_KEY, useAvatarApi } from '../services/avatarApi'
import { useAvatars } from '../context/AvatarContext'

const USE_LOADING_ROUTE = import.meta.env.VITE_USE_LOADING_ROUTE === 'true';

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
  const [confirmPos, setConfirmPos] = useState<{ top: number; height: number } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    setConfirmPos({ top: rect.top, height: rect.height })
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

  return (
    <div className={styles.loggedInPage}>
      <Header
        title="Welcome back!"
        variant="dark"
        onExit={() => navigate('/')}
        rightContent={<span className={styles.count}>{avatars.length}/{maxAvatars}</span>}
      />

      <ul className={styles.avatarList}>
        {avatars.map((avatar) => {
          const isDeleting = deletingId === avatar.id
          const isConfirmingThis = showDeleteConfirm === avatar.id
          return (
            <li key={avatar.id} className={styles.avatarItem}>
              <button
                className={`${styles.avatarName}${selectedAvatarId === avatar.id ? ' ' + styles.selected : ''}`}
                onClick={() => handleSelect(avatar.id)}
                type="button"
                disabled={Boolean(showDeleteConfirm)} // spriječi promjenu selekcije dok je potvrda otvorena
              >
                {avatar.name}
              </button>
              <button
                className={styles.iconButton}
                aria-label="remove avatar"
                type="button"
                onClick={() => handleDeleteClick(avatar.id)}
                disabled={loaderState.isLoading || Boolean(deletingId)}
                title={isDeleting ? 'Deleting…' : isConfirmingThis ? 'Confirm below' : 'Remove avatar'}
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

      <Footer
        topButtonText="Load Avatar"
        onTopButton={handleLoad}
        topButtonDisabled={
          selectedAvatarId === null ||
          selectedAvatarId === loadedAvatarId ||
          loaderState.isLoading ||
          Boolean(showDeleteConfirm) // ne loadaj dok potvrđuješ brisanje
        }
        topButtonType="primary"
        backText={showDeleteConfirm ? 'Cancel' : 'Back'}
        actionText={showDeleteConfirm ? (deletingId ? 'Deleting…' : 'Delete Avatar') : 'Create New Avatar'}
        onBack={() => (showDeleteConfirm ? cancelDelete() : navigate('/login'))}
        onAction={() => (showDeleteConfirm ? confirmDelete() : navigate('/avatar-info'))}
        actionDisabled={showDeleteConfirm ? Boolean(deletingId) : avatars.length >= maxAvatars}
        actionType={showDeleteConfirm ? 'black' : 'black'}
        loadButtonRef={loadButtonRef}
      />

      {showDeleteConfirm && confirmPos && (
        <div
          className={styles.deleteConfirmOverlay}
          style={{ top: confirmPos.top, height: confirmPos.height }}
        >
          <div className={styles.deleteConfirmRow}>
            Are you sure?
          </div>
        </div>
      )}
    </div>
  )
}