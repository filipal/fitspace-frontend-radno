import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import BodyShape1 from '../assets/bodyshape-1.svg?react'
import BodyShape2 from '../assets/bodyshape-2.svg?react'
import BodyShape3 from '../assets/bodyshape-3.svg?react'
import BodyShape4 from '../assets/bodyshape-4.svg?react'
import BodyShape5 from '../assets/bodyshape-5.svg?react'
import athleticTrack from '../assets/athletic-slide.svg'
import athleticCircle from '../assets/athletic-circle.svg'
import athleticThin from '../assets/athletic-thin.svg'
import athleticNormal from '../assets/athletic-normal.svg'
import athleticMuscular from '../assets/athletic-muscular.svg'
import styles from './QuickMode.module.scss'

const bodyShapes = [
  { id: 1, Icon: BodyShape1, label: 'Shape 1', width: 33, height: 55 },
  { id: 2, Icon: BodyShape2, label: 'Shape 2', width: 42, height: 55 },
  { id: 3, Icon: BodyShape3, label: 'Shape 3', width: 30, height: 55 },
  { id: 4, Icon: BodyShape4, label: 'Shape 4', width: 55, height: 55 },
  { id: 5, Icon: BodyShape5, label: 'Shape 5', width: 38, height: 55 },
]

const measurementOptions = Array.from({ length: 100 }, (_, i) => (60 + i).toString())

export default function QuickMode() {
  const navigate = useNavigate()

  const [selectedBodyShape, setSelectedBodyShape] = useState(3)
  const [athleticLevel, setAthleticLevel] = useState(1) // 0, 1, 2
  const [bustCircumference, setBustCircumference] = useState('')
  const [waistCircumference, setWaistCircumference] = useState('')
  const [lowHipCircumference, setLowHipCircumference] = useState('')

  // Helper to get slider value from X position
  const getSliderValue = (clientX: number, slider: HTMLDivElement | null) => {
    if (!slider) return athleticLevel
    const rect = slider.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = x / rect.width
    const newLevel = Math.round(percentage * 2)
    return Math.max(0, Math.min(2, newLevel))
  }

  // Mouse events
  const handleSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = e.currentTarget as HTMLDivElement
    const newLevel = getSliderValue(e.clientX, slider)
    setAthleticLevel(newLevel)
    window.addEventListener('mousemove', handleSliderMouseMove)
    window.addEventListener('mouseup', handleSliderMouseUp)
  }

  const handleSliderMouseMove = (e: MouseEvent) => {
    const slider = document.getElementById('athletic-slider-track') as HTMLDivElement | null
    if (!slider) return
    const newLevel = getSliderValue(e.clientX, slider)
    setAthleticLevel(newLevel)
  }

  const handleSliderMouseUp = () => {
    window.removeEventListener('mousemove', handleSliderMouseMove)
    window.removeEventListener('mouseup', handleSliderMouseUp)
  }

  // Touch events
  const handleSliderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const slider = e.currentTarget as HTMLDivElement
    const touch = e.touches[0]
    const newLevel = getSliderValue(touch.clientX, slider)
    setAthleticLevel(newLevel)
    window.addEventListener('touchmove', handleSliderTouchMove)
    window.addEventListener('touchend', handleSliderTouchEnd)
  }

  const handleSliderTouchMove = (e: TouchEvent) => {
    const slider = document.getElementById('athletic-slider-track') as HTMLDivElement | null
    if (!slider) return
    const touch = e.touches[0]
    const newLevel = getSliderValue(touch.clientX, slider)
    setAthleticLevel(newLevel)
  }

  const handleSliderTouchEnd = () => {
    window.removeEventListener('touchmove', handleSliderTouchMove)
    window.removeEventListener('touchend', handleSliderTouchEnd)
  }

  return (
      <div className={styles.quickmodePage}>
      <div className={styles.canvas}>
      {/* Header */}
      <Header
        title="Body Shape & Fitness"
        variant="dark"
        onExit={() => navigate('/')}
        onInfo={() => navigate('/use-of-data')}
      />
      <div className={styles.quickmodeContent}>
        {/* Body Shape */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>What’s your body shape?</div>
          <div className={styles.bodyshapeRow}>
            {bodyShapes.map((shape) => (
              <button
                key={shape.id}
                className={`${styles.buttonReset} ${styles.bodyshapeBtn}`}
                onClick={() => setSelectedBodyShape(shape.id)}
                aria-label={shape.label}
                type="button"
              >
                <shape.Icon
                  width={shape.width}
                  height={shape.height}
                  fill={selectedBodyShape === shape.id ? '#000' : '#fff'}
                  className={styles.bodyshapeIcon}
                  color={selectedBodyShape === shape.id ? '#000' : '#fff'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Athletic Level */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>How athletic are you?</div>
        <div className={styles.athleticSliderWrap}>
          <div
            id="athletic-slider-track"
            className={styles.athleticSliderTrack}
            onMouseDown={handleSliderMouseDown}
            onTouchStart={handleSliderTouchStart}
          >
            <img src={athleticTrack} alt="" className={styles.athleticTrack} />
            <img
              src={athleticCircle}
              alt=""
              className={`${styles.athleticCircle} ${
                athleticLevel === 0
                  ? styles.level0
                  : athleticLevel === 1
                    ? styles.level1
                    : styles.level2
              }`}
              draggable={false}
            />
          </div>
          <div className={styles.athleticIcons}>
            <img src={athleticThin} alt="Thin" />
            <img src={athleticNormal} alt="Normal" />
            <img src={athleticMuscular} alt="Muscular" />
          </div>
        </div>
        </div>

        {/* Measurements */}
        <div className={styles.sectionMeasurements}>
          <div className={styles.measureRow}>
            <div className={styles.measureLabel}>Bust Circumference</div>
            <select
              value={bustCircumference}
              onChange={e => setBustCircumference(e.target.value)}
              className={styles.measureSelect}
            >
              <option value="">...</option>
              {measurementOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span className={styles.measureUnit}>cm</span>
          </div>
          <div className={styles.measureRow}>
            <div className={styles.measureLabel}>Waist Circumference</div>
            <select
              value={waistCircumference}
              onChange={e => setWaistCircumference(e.target.value)}
              className={styles.measureSelect}
            >
              <option value="">...</option>
              {measurementOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span className={styles.measureUnit}>cm</span>
          </div>
          <div className={styles.measureRow}>
            <div className={styles.measureLabel}>Low Hip Circumference</div>
            <select
              value={lowHipCircumference}
              onChange={e => setLowHipCircumference(e.target.value)}
              className={styles.measureSelect}
            >
              <option value="">...</option>
              {measurementOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span className={styles.measureUnit}>cm</span>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className={styles.footerSlot}>
      <Footer
        backText="Back"
        actionText="Generate Avatar"
        onBack={() => navigate('/avatar-info')}
        onAction={() => navigate('/unreal-measurements')}
        actionDisabled={
          !selectedBodyShape ||
          bustCircumference === '' ||
          waistCircumference === '' ||
          lowHipCircumference === ''
        }
        actionType="primary"
      />
      </div>
    </div>
    </div>
  )
}
