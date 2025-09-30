import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import deleteIcon from '../assets/delete-avatar.svg'
import styles from './LoggedInPage.module.scss'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import { LAST_LOADED_AVATAR_STORAGE_KEY, useAvatarApi } from '../services/avatarApi'

interface Avatar {
  id: number
  name: string
  isSelected?: boolean
}

export default function LoggedInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loadAvatar, loaderState } = useAvatarLoader()
  const { fetchAvatarById } = useAvatarApi()
  const locationState = location.state as { nextRoute?: string } | null

  const [avatars, setAvatars] = useState<Avatar[]>([
    { id: 1, name: 'Avatar Name 1' },
    { id: 2, name: 'Avatar Name 2' },
    { id: 3, name: 'Avatar Name 3' },
  ])
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null)
  const [loadedAvatarId, setLoadedAvatarId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<null | number>(null)
  const [confirmPos, setConfirmPos] = useState<{ top: number; height: number } | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const loadButtonRef = useRef<HTMLButtonElement | null>(null)

  const handleSelect = (id: number) => setSelectedAvatarId(id)
  const handleLoad = useCallback(async () => {
    if (selectedAvatarId === null || loaderState.isLoading) return

    try {
      setFetchError(null)
      const avatarData = await fetchAvatarById(selectedAvatarId)
      const result = await loadAvatar(avatarData)

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to load avatar configuration')
      }

      setLoadedAvatarId(selectedAvatarId)

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, String(selectedAvatarId))
      }

      const targetRoute = locationState?.nextRoute ?? '/virtual-try-on'

      navigate(targetRoute, { state: { avatarId: selectedAvatarId } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load avatar'
      setFetchError(message)
      console.error('Failed to load avatar', error)
    }
  }, [fetchAvatarById, loadAvatar, loaderState.isLoading, locationState?.nextRoute, navigate, selectedAvatarId])
    
  const handleDelete = (id: number) => setShowDeleteConfirm(id)

  const confirmDelete = () => {
    setAvatars(avatars.filter(a => a.id !== showDeleteConfirm))
    setAvatars(prevAvatars => {
      const updatedAvatars = prevAvatars.filter(a => a.id !== showDeleteConfirm)
      const firstAvatarId = updatedAvatars[0]?.id ?? null

      setSelectedAvatarId(prevSelected => {
        if (prevSelected === null) return null
        if (prevSelected === showDeleteConfirm) return firstAvatarId
        if (!updatedAvatars.some(a => a.id === prevSelected)) return firstAvatarId
        return prevSelected
      })

      setLoadedAvatarId(prevLoaded => {
        if (prevLoaded === null) return null
        if (prevLoaded === showDeleteConfirm) return firstAvatarId
        if (!updatedAvatars.some(a => a.id === prevLoaded)) return firstAvatarId
        return prevLoaded
      })

      return updatedAvatars
    })
    setShowDeleteConfirm(null)
    setConfirmPos(null)
  }

  const positionConfirm = useCallback(() => {
    if (loadButtonRef.current) {
      const rect = loadButtonRef.current.getBoundingClientRect()
      setConfirmPos({
        top: rect.top,
        height: rect.height
      })
    }
  }, [])

  useEffect(() => {
    if (showDeleteConfirm) {
      positionConfirm()
      window.addEventListener('resize', positionConfirm)
      window.addEventListener('scroll', positionConfirm)
      return () => {
        window.removeEventListener('resize', positionConfirm)
        window.removeEventListener('scroll', positionConfirm)
      }
    } else {
      setConfirmPos(null)
    }
  }, [showDeleteConfirm, positionConfirm])

  const loaderMessage = useMemo(() => {
    if (!loaderState.isLoading) {
      return null
    }

    switch (loaderState.stage) {
      case 'validation':
        return 'Validating avatar data…'
      case 'transformation':
        return 'Preparing avatar morphs…'
      case 'command_generation':
        return 'Generating avatar commands…'
      case 'unreal_communication':
        return 'Sending avatar to Unreal Engine…'
      case 'complete':
        return 'Avatar ready!'
      default:
        return 'Loading avatar…'
    }
  }, [loaderState.isLoading, loaderState.stage])

  return (
    <div className={styles.loggedInPage}>
      <Header
        title="Welcome back!"
        variant="dark"
        onExit={() => navigate('/')}
        rightContent={<span className={styles.count}>{avatars.length}/5</span>}
      />

      <ul className={styles.avatarList}>
        {avatars.map((avatar) => (
          <li key={avatar.id} className={styles.avatarItem}>
            <button
              className={`${styles.avatarName}${selectedAvatarId === avatar.id ? ' ' + styles.selected : ''}`}
              onClick={() => handleSelect(avatar.id)}
              type="button"
            >
              {avatar.name}
            </button>
            <button
              className={styles.iconButton}
              aria-label="remove avatar"
              onClick={() => handleDelete(avatar.id)}
            >
              <img src={deleteIcon} alt="Delete Avatar" />
            </button>
          </li>
        ))}
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

      {(loaderState.error || fetchError) && (
        <div className={styles.errorBanner}>
          {loaderState.error ?? fetchError}
        </div>
      )}

      <Footer
        topButtonText="Load Avatar"
        onTopButton={handleLoad}
        topButtonDisabled={
          selectedAvatarId === null ||
          selectedAvatarId === loadedAvatarId ||
          loaderState.isLoading
        }
        topButtonType="primary"
        backText={showDeleteConfirm ? 'Cancel' : 'Back'}
        actionText={showDeleteConfirm ? 'Delete Avatar' : 'Create New Avatar'}
        onBack={() => {
          if (showDeleteConfirm) {
            setShowDeleteConfirm(null)
            setConfirmPos(null)
          } else {
            navigate('/login')
          }
        }}
        onAction={() => showDeleteConfirm ? confirmDelete() : navigate('/avatar-info')}
        actionDisabled={false}
        actionType="black"
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
