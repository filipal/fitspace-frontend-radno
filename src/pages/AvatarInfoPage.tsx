import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import cn from 'classnames'
import { useNavigate } from 'react-router-dom'
import leftArrow from '../assets/arrow-left.svg'
import rightArrow from '../assets/arrow-right.svg'
import cameraIcon from '../assets/camera.png'
import quickIcon from '../assets/quick.png'
import Header from '../components/Header/Header'
import ResponsivePage from '../components/ResponsivePage/ResponsivePage'
import styles from './AvatarInfoPage.module.scss'
import {
  useAvatarApi,
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  LAST_LOADED_AVATAR_STORAGE_KEY,
  buildBackendMorphPayload,
} from '../services/avatarApi'
import type { AvatarPayload } from '../services/avatarApi'
import { useAvatars } from '../context/AvatarContext'
import { useAvatarConfiguration } from '../context/AvatarConfigurationContext'
import type { BackendAvatarMorphTarget } from '../context/AvatarConfigurationContext'
import useIsMobile from '../hooks/useIsMobile'
import { useAuthData } from '../hooks/useAuthData'

const MOBILE_DESIGN_WIDTH = 393
const FIGMA_REFERENCE_WIDTH = 430
const HEADER_DESIGN_HEIGHT = 71.31
const MOBILE_DESIGN_HEIGHT = 586.69
const MOBILE_SAFE_HEIGHT = MOBILE_DESIGN_HEIGHT + HEADER_DESIGN_HEIGHT
const HEADER_MIN_SCALE = 0.65
const CONTENT_MIN_SCALE = 0.6
const DESKTOP_BREAKPOINT = 768
const DESKTOP_DESIGN_WIDTH = 1440
const DESKTOP_DESIGN_HEIGHT = 1024
const MIN_BOTTOM_PADDING = 12

interface ViewportSize {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

type AvatarInfoPageCssVars = CSSProperties & {
  '--fs-design-width'?: string
  '--fs-design-height'?: string
  '--fs-design-safe-height'?: string
  '--fs-viewport-height'?: string
  '--fs-scale-width'?: string
  '--fs-scale-height'?: string
  '--fs-scale-height-content'?: string
  '--fs-scale'?: string
  '--fs-canvas-width'?: string
  '--fs-canvas-height'?: string
  '--fs-page-max-height'?: string
  '--fs-bottom-padding'?: string
}

function readViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return {
      width: MOBILE_DESIGN_WIDTH,
      height: MOBILE_SAFE_HEIGHT,
    }
  }

  const viewport = window.visualViewport
  if (viewport) {
    return { width: viewport.width, height: viewport.height }
  }

  return { width: window.innerWidth, height: window.innerHeight }
}

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
  const { avatars, maxAvatars, refreshAvatars, setPendingAvatarName } = useAvatars()
  const authData = useAuthData()
  const [viewportSize, setViewportSize] = useState<ViewportSize>(() => readViewportSize())
  const {
    width: viewportWidth,
    height: viewportHeight,
  } = viewportSize
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
  const isMobile = useIsMobile(1024)

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

  const { cssVars: layoutVars, pageHeight } = useMemo(() => {
    if (viewportWidth >= DESKTOP_BREAKPOINT) {
      const designWidth = Math.min(DESKTOP_DESIGN_WIDTH, viewportWidth)
      const designHeight = DESKTOP_DESIGN_HEIGHT
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
      const canvasWidth = designWidth
      const canvasHeight = designHeight
      const pageMaxHeight = Math.max(canvasHeight, viewportHeight)

      const cssVars: AvatarInfoPageCssVars = {
        '--fs-design-width': `${designWidth}px`,
        '--fs-design-height': `${designHeight}px`,
        '--fs-design-safe-height': `${designHeight}px`,
        '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
        '--fs-scale-width': scaleWidth.toFixed(5),
        '--fs-scale-height': scaleHeight.toFixed(5),
        '--fs-scale-height-content': scaleHeight.toFixed(5),
        '--fs-scale': '1',
        '--fs-canvas-width': `${canvasWidth.toFixed(3)}px`,
        '--fs-canvas-height': `${canvasHeight.toFixed(3)}px`,
        '--fs-page-max-height': `${pageMaxHeight.toFixed(3)}px`,
        '--fs-header-scale-max': '1',
        '--fs-bottom-padding': `${MIN_BOTTOM_PADDING}px`,
      }

      return { cssVars, pageHeight: canvasHeight }
    }

    const scaleWidth = clamp(
      viewportWidth / MOBILE_DESIGN_WIDTH,
      0,
      Number.POSITIVE_INFINITY
    )
    const segments = [
      { key: 'header' as const, base: HEADER_DESIGN_HEIGHT, minScale: HEADER_MIN_SCALE, weight: 0.9 },
      { key: 'content' as const, base: MOBILE_DESIGN_HEIGHT, minScale: CONTENT_MIN_SCALE, weight: 1 },
    ]

    const fullFlexibleHeight = segments.reduce((sum, segment) => sum + segment.base, 0)
    const minFlexibleHeight = segments.reduce(
      (sum, segment) => sum + segment.base * segment.minScale,
      0,
    )
    const targetHeight = clamp(
      viewportHeight,
      minFlexibleHeight,
      fullFlexibleHeight,
    )

    const working = segments.map((segment) => ({ ...segment, scale: 1 }))
    let currentHeight = fullFlexibleHeight

    for (let iteration = 0; iteration < 6; iteration += 1) {
      if (currentHeight <= targetHeight + 0.01) {
        break
      }

      const shrinkable = working.filter(
        (segment) => segment.scale > segment.minScale + 0.0001,
      )

      if (shrinkable.length === 0) {
        break
      }

      const totalCapacity = shrinkable.reduce((sum, segment) => {
        const capacity = (segment.scale - segment.minScale) * segment.base
        return sum + capacity * segment.weight
      }, 0)

      if (totalCapacity <= 0) {
        break
      }

      const excess = currentHeight - targetHeight
      let consumed = 0

      shrinkable.forEach((segment) => {
        const capacity = (segment.scale - segment.minScale) * segment.base
        if (capacity <= 0) {
          return
        }

        const weightedCapacity = capacity * segment.weight
        const shrinkHeight = Math.min(
          capacity,
          (excess * weightedCapacity) / totalCapacity,
        )

        if (shrinkHeight <= 0) {
          return
        }

        segment.scale -= shrinkHeight / segment.base
        consumed += shrinkHeight
      })

      if (consumed <= 0.001) {
        break
      }

      currentHeight -= consumed
    }

    let headerScale = HEADER_MIN_SCALE
    let contentScale = CONTENT_MIN_SCALE

    working.forEach((segment) => {
      const finalScale = clamp(segment.scale, segment.minScale, 1)
      if (segment.key === 'header') {
        headerScale = finalScale
      } else {
        contentScale = finalScale
      }
    })

    const designHeight = headerScale * HEADER_DESIGN_HEIGHT + contentScale * MOBILE_DESIGN_HEIGHT
    const heightScaleSafe = designHeight / MOBILE_SAFE_HEIGHT
    const heightScaleContent = contentScale
    const viewportScaleWidth = clamp(scaleWidth, 0, Number.POSITIVE_INFINITY)
    const viewportScaleHeight = designHeight > 0
      ? clamp(viewportHeight / designHeight, 0, Number.POSITIVE_INFINITY)
      : 1
    const viewportScale = clamp(
      Math.min(viewportScaleWidth, viewportScaleHeight),
      0,
      Number.POSITIVE_INFINITY,
    )
    const canvasWidth = MOBILE_DESIGN_WIDTH * viewportScale
    const pageHeight = designHeight
    const scaledPageHeight = pageHeight * viewportScale
    const canvasHeight = MOBILE_DESIGN_HEIGHT * heightScaleContent * viewportScale
    const pageMaxHeight = Math.max(scaledPageHeight, viewportHeight)
    const widthRatioToFigma = MOBILE_DESIGN_WIDTH / FIGMA_REFERENCE_WIDTH
    const desiredBottomPadding = Math.min(
      45,
      45 * viewportScale * widthRatioToFigma,
    )
    const extraSpace = Math.max(viewportHeight - scaledPageHeight, 0)
    const bottomPadding = Math.max(
      desiredBottomPadding - extraSpace,
      MIN_BOTTOM_PADDING,
    )

    const cssVars: AvatarInfoPageCssVars = {
      '--fs-design-width': `${MOBILE_DESIGN_WIDTH}px`,
      '--fs-design-height': `${MOBILE_DESIGN_HEIGHT.toFixed(3)}px`,
      '--fs-design-safe-height': `${MOBILE_SAFE_HEIGHT.toFixed(3)}px`,
      '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
      '--fs-scale-width': viewportScaleWidth.toFixed(5),
      '--fs-scale-height': heightScaleSafe.toFixed(5),
      '--fs-scale-height-content': heightScaleContent.toFixed(5),
      '--fs-scale': viewportScale.toFixed(5),
      '--fs-canvas-width': `${canvasWidth.toFixed(3)}px`,
      '--fs-canvas-height': `${canvasHeight.toFixed(3)}px`,
      '--fs-page-max-height': `${pageMaxHeight.toFixed(3)}px`,
      '--fs-bottom-padding': `${bottomPadding.toFixed(3)}px`,
    }

    return { cssVars, pageHeight: scaledPageHeight }
  }, [viewportHeight, viewportWidth])

  const needsScroll =
    viewportWidth >= DESKTOP_BREAKPOINT || pageHeight > viewportHeight + 0.5
  const pageClassName = needsScroll
    ? `${styles.page} ${styles.pageScrollable}`
    : styles.page

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
    <ResponsivePage
      style={layoutVars}
      className={pageClassName}
      bodyClassName={styles.body}
      contentClassName={styles.avatarInfoPage}
      header={
        <div className={styles.headerWrapper}>
          <div className={styles.headerInner}>
            <Header
              title="Create your Avatar"
              variant="dark"
              onExit={() => navigate('/')}
              onInfo={() => navigate('/use-of-data')}
            />
          </div>
        </div>
      }
    >
      <div className={styles.canvas}>
        <div className={styles.canvasContent}>
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
                    if (isMobile) {
                      navigate('/body-scan-info');
                    } else {
                      navigate('/scan-qr-bodyscan', { state: { mode: 'body' } });
                    }
                  }}
                  type="button"
                >
                  <img src={cameraIcon} alt="" className={styles.buttonIcon1} />
                  Scan Body
                </button>
                <div className={styles.scanDesc}>
                  <span className={styles.scanDescFirst}>
                    Highly accurate. Scan your body & face
                  </span>
                  <span className={styles.scanDescSecond}>
                    with a phone in 3 minutes.
                  </span>
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
                      const basePayload: AvatarPayload = {
                        name: fallbackName,
                        gender,
                        ageRange,
                        creationMode: 'preset' as const,
                        quickMode: true,
                        basicMeasurements: {
                          height: heightValue,
                          weight: weightValue,
                          creationMode: 'preset' as const,
                        },
                        bodyMeasurements: {},
                        morphTargets: {},
                        quickModeSettings: null,
                      }
                      if (!authData.isAuthenticated) {
                        if (typeof window !== 'undefined') {
                          try {
                            window.sessionStorage.removeItem(LAST_LOADED_AVATAR_STORAGE_KEY)
                            window.sessionStorage.setItem(
                              LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
                              JSON.stringify({
                                avatarId: null,
                                name: basePayload.name,
                                avatarName: basePayload.name,
                                gender: basePayload.gender,
                                ageRange: basePayload.ageRange,
                                basicMeasurements: basePayload.basicMeasurements,
                                bodyMeasurements: basePayload.bodyMeasurements,
                                morphTargets: null,
                                quickMode: basePayload.quickMode,
                                creationMode: basePayload.creationMode,
                                quickModeSettings: basePayload.quickModeSettings,
                                source: 'guest',
                              }),
                            )
                          } catch (storageError) {
                            console.warn('Failed to persist guest avatar metadata', storageError)
                          }
                        }

                        setPendingAvatarName(null)
                        setIsSubmitting(false)
                        navigate('/quickmode')
                        return
                      }

                      const morphs = buildBackendMorphPayload(basePayload)

                      const payload: AvatarPayload = {
                        ...basePayload,
                        ...(morphs ? { morphs } : {}),
                      }

                      if (morphs) {
                        delete (payload as { morphTargets?: Record<string, number> }).morphTargets
                      }

                      const result = await createAvatar(payload)

                      const backendAvatar = result.backendAvatar
                      const resolvedAvatarId = backendAvatar?.id ?? result.avatarId

                      if (typeof window !== 'undefined' && resolvedAvatarId) {
                        window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, resolvedAvatarId)
                        const storageMorphTargets = backendAvatar?.morphTargets
                          ?? (Array.isArray(morphs)
                            ? morphs
                                .map((morph): BackendAvatarMorphTarget | null => {
                                  if (!morph) return null
                                  const key = morph.backendKey ?? morph.id
                                  const value = Number(morph.sliderValue)
                                  if (!key || !Number.isFinite(value)) {
                                    return null
                                  }
                                  return { name: key, value }
                                })
                                .filter((entry): entry is BackendAvatarMorphTarget => Boolean(entry))
                            : undefined)
                          ?? (basePayload.morphTargets
                            ? Object.entries(basePayload.morphTargets).reduce<BackendAvatarMorphTarget[]>((acc, [key, value]) => {
                                if (!key) {
                                  return acc
                                }
                                const numericValue = Number(value)
                                if (Number.isFinite(numericValue)) {
                                  acc.push({ name: key, value: numericValue })
                                }
                                return acc
                              }, [])
                            : undefined)

                        window.sessionStorage.setItem(
                          LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
                          JSON.stringify({
                            avatarId: resolvedAvatarId,
                            name: backendAvatar?.name ?? payload.name,
                            avatarName: backendAvatar?.name ?? payload.name,
                            gender: backendAvatar?.gender ?? gender,
                            ageRange: backendAvatar?.ageRange ?? ageRange,
                            basicMeasurements:
                              backendAvatar?.basicMeasurements ?? payload.basicMeasurements,
                            bodyMeasurements:
                              backendAvatar?.bodyMeasurements ?? payload.bodyMeasurements,
                            morphTargets: storageMorphTargets ?? null,
                            quickMode: backendAvatar?.quickMode ?? true,
                            creationMode: backendAvatar?.creationMode ?? payload.creationMode,
                            quickModeSettings:
                              backendAvatar?.quickModeSettings ?? payload.quickModeSettings ?? null,
                            source: backendAvatar?.source ?? payload.source,
                          }),
                        )
                      }

                      if (resolvedAvatarId) {
                        try {
                          await refreshAvatars()
                        } catch (refreshError) {
                          console.error('Failed to refresh avatars after creation', refreshError)
                        }
                      }

                      if (backendAvatar) {
                        await loadAvatarFromBackend(backendAvatar, undefined, resolvedAvatarId ?? undefined)
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
                  <span className={styles.quickDescFirst}>
                    Fastest, but may not be as accurate. 
                  </span>
                  <span className={styles.quickDescSecond}>
                     Enter main body measurements and choose your body type.
                  </span>
                </div>
              </div>
            </div>
            <button
              className={styles.backButtonAvatarinfo}
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  navigate(-1)
                  return
                }

                navigate('/')
              }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </ResponsivePage>
  )
}