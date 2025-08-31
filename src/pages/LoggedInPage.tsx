import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import deleteIcon from '../assets/delete-avatar.svg'
import styles from './LoggedInPage.module.scss'

interface Avatar {
  id: number
  name: string
  isSelected?: boolean
}

export default function LoggedInPage() {
  const navigate = useNavigate()

  const [avatars, setAvatars] = useState<Avatar[]>([
    { id: 1, name: 'Avatar Name 1' },
    { id: 2, name: 'Avatar Name 2' },
    { id: 3, name: 'Avatar Name 3' },
  ])
  const [selectedAvatarId, setSelectedAvatarId] = useState<number>(1)
  const [loadedAvatarId, setLoadedAvatarId] = useState<number>(1)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<null | number>(null)
  const [confirmPos, setConfirmPos] = useState<{ top: number; height: number } | null>(null)
  const loadButtonRef = useRef<HTMLButtonElement | null>(null)

  const handleSelect = (id: number) => setSelectedAvatarId(id)
  const handleLoad = () => {
    setLoadedAvatarId(selectedAvatarId)
    navigate('/virtual-try-on')
  }
  const handleDelete = (id: number) => setShowDeleteConfirm(id)

  const confirmDelete = () => {
    setAvatars(avatars.filter(a => a.id !== showDeleteConfirm))
    if (selectedAvatarId === showDeleteConfirm) setSelectedAvatarId(avatars[0]?.id || 0)
    if (loadedAvatarId === showDeleteConfirm) setLoadedAvatarId(avatars[0]?.id || 0)
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

      <Footer
        topButtonText="Load Avatar"
        onTopButton={handleLoad}
        topButtonDisabled={selectedAvatarId === loadedAvatarId}
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
          style={{
            position: 'fixed',
            top: confirmPos.top,
            left: 0,
            width: '100vw',
            height: confirmPos.height,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div className={styles.deleteConfirmRow} style={{ pointerEvents: 'auto', width: '100%' }}>
            Are you sure?
          </div>
        </div>
      )}
    </div>
  )
}
