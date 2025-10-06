import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import deleteIcon from '../assets/delete-avatar.svg'
import styles from './LoggedInPage.module.scss'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import { LAST_LOADED_AVATAR_STORAGE_KEY, useAvatarApi } from '../services/avatarApi'
import { useAvatars } from '../context/AvatarContext'

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

  useEffect(() => {
    if (avatars.length > 0) return
    refreshAvatars().catch(err => console.error('Failed to refresh avatars', err))
  }, [avatars.length, refreshAvatars])

  useEffect(() => {
    if (avatars.length === 0) {
      setSelectedAvatarId(null)
      return
    }
    setSelectedAvatarId(prev => {
      if (prev && avatars.some(a => a.id === prev)) return prev
      if (loadedAvatarId && avatars.some(a => a.id === loadedAvatarId)) return loadedAvatarId
      return avatars[0]?.id ?? null
    })
  }, [avatars, loadedAvatarId])

  const handleSelect = (id: string) => setSelectedAvatarId(id)

  const handleLoad = useCallback(async () => {
    if (selectedAvatarId === null || loaderState.isLoading) return
    try {
      setFetchError(null)
      const avatarData = await fetchAvatarById(selectedAvatarId)
      const result = await loadAvatar(avatarData)
      if (!result.success) throw new Error(result.error ?? 'Failed to load avatar configuration')

      setLoadedAvatarId(selectedAvatarId)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, String(selectedAvatarId))
      }
      const targetRoute = locationState?.nextRoute ?? '/virtual-try-on'
      navigate(targetRoute, { state: { avatarId: selectedAvatarId } })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load avatar'
      setFetchError(msg)
      console.error('Failed to load avatar', e)
    }
  }, [fetchAvatarById, loadAvatar, loaderState.isLoading, locationState?.nextRoute, navigate, selectedAvatarId])

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
