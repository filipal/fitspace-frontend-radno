import { useMemo, useState } from 'react'
import cn from 'classnames'
import { useNavigate } from 'react-router-dom'
import leftArrow from '../assets/arrow-left.svg'
import rightArrow from '../assets/arrow-right.svg'
import cameraIcon from '../assets/camera.png'
import quickIcon from '../assets/quick.png'
import Header from '../components/Header/Header'
import styles from './AvatarInfoPage.module.scss'
import { useAvatarApi, LAST_CREATED_AVATAR_METADATA_STORAGE_KEY, LAST_LOADED_AVATAR_STORAGE_KEY } from '../services/avatarApi'
import type { AvatarPayload } from '../services/avatarApi'
import { useAvatars } from '../context/AvatarContext'
import { useAvatarConfiguration } from '../context/AvatarConfigurationContext'

const ages = ['15-19', ...Array.from({ length: 8 }, (_, i) => {
  const start = 20 + i * 10
  const end = start + 9
  return `${start}-${end}`
})]
const heights = Array.from({ length: 51 }, (_, i) => String(150 + i))
const weights = Array.from({ length: 101 }, (_, i) => String(50 + i))

function usePicker(initial: number, values: string[]) {
  const [index, setIndex] = useState(initial)
  const prev = () => setIndex((i) => (i > 0 ? i - 1 : i))
  const next = () => setIndex((i) => (i < values.length - 1 ? i + 1 : i))
  return { index, prev, next }
}

export default function AvatarInfoPage() {
  const navigate = useNavigate()
  const { createAvatar } = useAvatarApi()
  const { loadAvatarFromBackend } = useAvatarConfiguration()
  const { avatars, maxAvatars, updateAvatars, setPendingAvatarName } = useAvatars()
  const age = usePicker(1, ages)
  const height = usePicker(2, heights)
  const weight = usePicker(2, weights)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ageRange = useMemo(() => ages[age.index] ?? ages[0], [age.index])
  const heightValue = useMemo(() => Number(heights[height.index] ?? heights[0]), [height.index])
  const weightValue = useMemo(() => Number(weights[weight.index] ?? weights[0]), [weight.index])

  const Ghost = ({ className }: { className?: string }) => (
    // sadrži “dummy” tekst širine slične realnom, ali je nevidljiv
    <span className={cn(styles.pickerValue, className, styles.ghost)} aria-hidden="true">
      88
    </span>
  )

  // --- RENDER PICKER (age: 1+1 side; number: 2+2 side) ---
  const renderPicker = (
    label: string,
    state: ReturnType<typeof usePicker>,
    values: string[],
    variant: 'age' | 'number' = 'number'
  ) => {
    const i = state.index
    const L2 = values[i - 2]
    const L1 = values[i - 1]
    const C  = values[i]
    const R1 = values[i + 1]
    const R2 = values[i + 2]

    const isAge = variant === 'age'
    const isNumber = variant === 'number'

    return (
      <div className={cn(styles.picker, { [styles.pickerAge]: isAge, [styles.pickerNumber]: isNumber })}>
        <span className={styles.pickerLabel}>{label}</span>
        <div className={styles.pickerControl}>
          <button className={styles.arrowButton} onClick={state.prev}>
            <img src={leftArrow} alt="previous" />
          </button>
          <div className={styles.pickerValues}>
            {isAge ? (
              <>
                {L1 ? (
                  <span className={cn(styles.pickerValue, styles.side)}>{L1}</span>
                ) : (
                  <Ghost className={styles.side} />
                )}

                <span className={cn(styles.pickerValue, styles.selected)}>{C}</span>

                {R1 ? (
                  <span className={cn(styles.pickerValue, styles.side)}>{R1}</span>
                ) : (
                  <Ghost className={styles.side} />
                )}
              </>
            ) : (
              <>
                {L2 ? (
                  <span className={cn(styles.pickerValue, styles.side, styles.sideOuter)}>{L2}</span>
                ) : (
                  <Ghost className={cn(styles.side, styles.sideOuter)} />
                )}
                {L1 ? (
                  <span className={cn(styles.pickerValue, styles.side, styles.sideInner)}>{L1}</span>
                ) : (
                  <Ghost className={cn(styles.side, styles.sideInner)} />
                )}

                <span className={cn(styles.pickerValue, styles.selected)}>{C}</span>

                {R1 ? (
                  <span className={cn(styles.pickerValue, styles.side, styles.sideInner)}>{R1}</span>
                ) : (
                  <Ghost className={cn(styles.side, styles.sideInner)} />
                )}
                {R2 ? (
                  <span className={cn(styles.pickerValue, styles.side, styles.sideOuter)}>{R2}</span>
                ) : (
                  <Ghost className={cn(styles.side, styles.sideOuter)} />
                )}
              </>
            )}
          </div>
          <button className={styles.arrowButton} onClick={state.next}>
            <img src={rightArrow} alt="next" />
          </button>
        </div>
      </div>
    )
  }

  // --- PAGE ---
  return (
    <div className={styles.avatarInfoPage}>
      <div className={styles.canvas}>
        <Header
          title="Create your Avatar"
          variant="dark"
          onExit={() => navigate('/')}
          onInfo={() => navigate('/use-of-data')}
        />
        {/* Ime + spol */}
        <div className={styles.formSection}>
          <input
            className={styles.avatarNameInput}
            type="text"
            placeholder="Avatar’s Name"
            value={name}
            onChange={e => {
              setName(e.target.value)
              setPendingAvatarName(e.target.value)
            }}
          />
          <div className={styles.genderChoice}>
            <button
              className={cn(styles.genderButton, { [styles.genderButtonSelected]: gender === 'male' })}
              onClick={() => setGender('male')}
              type="button"
            >
              Male
            </button>
            <button
              className={cn(styles.genderButton, { [styles.genderButtonSelected]: gender === 'female' })}
              onClick={() => setGender('female')}
              type="button"
            >
              Female
            </button>
          </div>
          {error ? <div className={styles.errorMessage}>{error}</div> : null}
        </div>

        {/* PANEL – mob: stack; web: uokvireni panel */}
        <div className={styles.webPanel}>
          {/* Pickers */}
          <div className={styles.pickersGroup}>
            {renderPicker('Your Age Range:', age, ages, 'age')}
            {renderPicker('Your Height:',   height, heights, 'number')}
            {renderPicker('Your Weight:',   weight, weights, 'number')}
          </div>
          <div className={styles.howText}>How would you like to create your avatar?</div>

          <div className={styles.actionsGrid}>
            <div className={styles.action}>     
              <button className={styles.scanButton} 
                onClick={() => {
                  if (window.innerWidth >= 1440) {
                    navigate('/scan-qr-bodyscan')
                  } else {
                    navigate('/body-scan-info')
                  }
                }}>
                <img src={cameraIcon} alt="" className={styles.buttonIcon1} />
                Scan Body
              </button>
              <div className={styles.scanDesc}>
                Highly accurate.<br />
                Scan your body & face with a phone in 3 minutes.
              </div>
            </div>
            <div className={styles.action}>
            <button
              className={styles.quickButton}
              onClick={async () => {
                if (isSubmitting) return
                if (avatars.length >= maxAvatars) {
                  setError('Maximum number of avatars reached')
                  return
                }
                setIsSubmitting(true)
                setError(null)
                try {
                  const trimmedName = name.trim()
                  const fallbackName = trimmedName || `Avatar ${avatars.length + 1}`
                  const payload: AvatarPayload = {
                    name: fallbackName,
                    gender,
                    ageRange,
                    creationMode: 'manual' as const,
                    quickMode: true,    
                    basicMeasurements: {
                      height: heightValue,
                      weight: weightValue,
                      creationMode: 'manual' as const,
                    },
                    bodyMeasurements: {},
                    morphTargets: {},
                    quickModeSettings: null,
                  }

                  const result = await createAvatar(payload)

                  const resolvedAvatarId = result.backendAvatar?.data.avatarId ?? result.avatarId

                  if (typeof window !== 'undefined' && resolvedAvatarId) {
                    window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, resolvedAvatarId)
                    window.sessionStorage.setItem(
                      LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
                      JSON.stringify({
                        avatarId: resolvedAvatarId,
                        avatarName: result.backendAvatar?.data.avatarName ?? fallbackName,
                        gender: result.backendAvatar?.data.gender ?? gender,
                        ageRange: result.backendAvatar?.data.ageRange ?? ageRange,
                        basicMeasurements:
                          result.backendAvatar?.data.basicMeasurements ?? payload.basicMeasurements,
                        bodyMeasurements:
                          result.backendAvatar?.data.bodyMeasurements ?? payload.bodyMeasurements,
                        morphTargets:
                          result.backendAvatar?.data.morphTargets ?? payload.morphTargets,
                        quickMode: result.backendAvatar?.data.quickMode ?? true,
                        creationMode:
                          result.backendAvatar?.data.creationMode ?? payload.creationMode,
                        quickModeSettings:
                          result.backendAvatar?.data.quickModeSettings ?? payload.quickModeSettings ?? null,
                        source: result.backendAvatar?.data.source ?? payload.source,
                      }),
                    )
                  }

                  if (resolvedAvatarId) {
                    updateAvatars(prev => {
                      const next = [...prev]
                      const existingIndex = next.findIndex(avatar => avatar.id === resolvedAvatarId)
                      const record = {
                        id: resolvedAvatarId,
                        name: result.backendAvatar?.data.avatarName ?? fallbackName,
                        createdAt:
                          existingIndex >= 0
                            ? next[existingIndex].createdAt
                            : result.backendAvatar?.data.createdAt ?? new Date().toISOString(),
                      }
                      if (existingIndex >= 0) {
                        next[existingIndex] = { ...next[existingIndex], ...record }
                        return next
                      }
                      if (next.length >= maxAvatars) {
                        return next
                      }
                      next.push(record)
                      return next
                    })
                  }

                  if (result.backendAvatar) {
                    await loadAvatarFromBackend(result.backendAvatar, undefined, resolvedAvatarId ?? undefined)
                  }

                  setPendingAvatarName(null)
                  setIsSubmitting(false)
                  navigate('/quickmode')
                } catch (err) {
                  console.error('Failed to create avatar', err)
                  setIsSubmitting(false)
                  setError(err instanceof Error ? err.message : 'Failed to create avatar')
                }
              }}
              disabled={isSubmitting}
              type="button"
            >
              <img src={quickIcon} alt="" className={styles.buttonIcon} />
              {isSubmitting ? 'Creating...' : 'Quick Mode'}
            </button>
            <div className={styles.quickDesc}>
              Fastest, but may not be as accurate.<br />
              Enter main body measurements and choose your body type.
            </div>
            </div>
          </div>
          <button className={styles.backButtonAvatarinfo} onClick={() => navigate('/') }>
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
