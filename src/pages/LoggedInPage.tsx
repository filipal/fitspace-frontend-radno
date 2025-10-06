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
  const { fetchAvatarById } = useAvatarApi()
  const { avatars, refreshAvatars, maxAvatars } = useAvatars()
  const locationState = location.state as { nextRoute?: string } | null

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [loadedAvatarId, setLoadedAvatarId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  })
  const [fetchError, setFetchError] = useState<string | null>(null)
  const loadButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (avatars.length > 0) {
      return
    }

    refreshAvatars().catch(error => {
      console.error('Failed to refresh avatars', error)
    })
  }, [avatars.length, refreshAvatars])

  useEffect(() => {
    if (avatars.length === 0) {
      setSelectedAvatarId(null)
      return
    }

    setSelectedAvatarId(prev => {
      if (prev && avatars.some(avatar => avatar.id === prev)) {
        return prev
      }

      if (loadedAvatarId && avatars.some(avatar => avatar.id === loadedAvatarId)) {
        return loadedAvatarId
      }

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
        rightContent={<span className={styles.count}>{avatars.length}/{maxAvatars}</span>}
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
              type="button"
              disabled
              title="Deleting avatars will be available soon"
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
        backText="Back"
        actionText="Create New Avatar"
        onBack={() => navigate('/login')}
        onAction={() => navigate('/avatar-info')}
        actionDisabled={avatars.length >= maxAvatars}
        actionType="black"
        loadButtonRef={loadButtonRef}
      />
    </div>
  )
}
