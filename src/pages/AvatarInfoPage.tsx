import { useState } from 'react'
import cn from 'classnames'
import { useNavigate } from 'react-router-dom'
import leftArrow from '../assets/arrow-left.svg'
import rightArrow from '../assets/arrow-right.svg'
import cameraIcon from '../assets/camera.png'
import quickIcon from '../assets/quick.png'
import Header from '../components/Header/Header'
import styles from './AvatarInfoPage.module.scss'

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
  const age = usePicker(1, ages)
  const height = usePicker(2, heights)
  const weight = usePicker(2, weights)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [name, setName] = useState('')

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
            onChange={e => setName(e.target.value)}
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
                Highly accurate. Scan your body & face<br />
                with a phone in 3 minutes.
              </div>
            </div>
            <div className={styles.action}>
            <button className={styles.quickButton} onClick={() => navigate('/quickmode')}>
              <img src={quickIcon} alt="" className={styles.buttonIcon} />
              Quick Mode
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
