import { useState, useEffect, useLayoutEffect, useRef, type ComponentType, type SVGProps } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header/Header'
import { usePixelStreaming } from '../context/PixelStreamingContext'

import avatarsButton from '../assets/avatars-button.png'
import RLeft from '../assets/r-left.svg?react'
import RRight from '../assets/r-right.svg?react'
import UploadIcon from '../assets/upload.svg?react'
import FullScreenIcon from '../assets/full-screen.svg?react'
import DownloadIcon from '../assets/download.svg?react'
import unrealFBBodyButton from '../assets/unreal-fb-body-button.png'
import avatarMeasure from '../assets/unreal-full-body.png'
import bodyIcon from '../assets/body.png'
import faceIcon from '../assets/face.png'
import skinIcon from '../assets/skin.png'
import hairIcon from '../assets/hair.png'
import extrasIcon from '../assets/extras.png'
import saveIcon from '../assets/save.png'
import lengthIcon from '../assets/length.png'
import girthIcon from '../assets/girth.png'
import DataPanel from '../components/DataPanel/DataPanel'
import BodyAccordion from '../components/BodyAccordion/BodyAccordion'
import FaceAccordion from '../components/FaceAccordion/FaceAccordion'
import SkinAccordion from '../components/SkinAccordion/SkinAccordion'
import HairAccordion from '../components/HairAccordion/HairAccordion'
import ExtrasAccordion from '../components/ExtrasAccordion/ExtrasAccordion'
import styles from './UnrealMeasurements.module.scss'

interface ControlButton {
  key: string
  width: number
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  marginRight: number
}

interface NavButton {
  key: NavKey
  icon: string
  label: string
}

interface Measurement {
  name: string
  value: number
  icon: string // Može biti tekst ikona ili slika path
}

type NavKey = 'Body' | 'Face' | 'Skin' | 'Hair' | 'Extras' | 'Save'

export default function UnrealMeasurements() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const accordionRef = useRef<HTMLDivElement | null>(null)
  // State used by effects below must be declared before effects
  const [selectedControl, setSelectedControl] = useState<string | null>(null)
  const [selectedNav, setSelectedNav] = useState<NavKey | null>(null)
  const [avatarSrc] = useState<string>(avatarMeasure)

  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;

    const update = () => {
      // 1) najrobustnije:
      const w = el.clientWidth;                   // stvarna širina .page
      // 2) ili, ako baš želiš docEl, bar klampaj:
      // const w = Math.min(document.documentElement.clientWidth, el.clientWidth);
      el.style.setProperty('--page-w-px', `${w}px`);
    };

    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const header = document.querySelector('[data-app-header]') as HTMLElement | null;
    if (!page || !header) return;

    const set = () => {
      // uključuje sve paddinge/bordere (i safe-area) jer je to realna visina u layoutu
      const h = Math.round(header.getBoundingClientRect().height);
      page.style.setProperty('--header-real-h', `${h}px`);
    };

    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);

    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);

  useLayoutEffect(() => {
    const page = pageRef.current
    const header = document.querySelector('[data-app-header]') as HTMLElement | null
    const bottom = bottomRef.current
    if (!page || !header || !bottom) return

    const set = () => {
      const viewportH = window.visualViewport?.height ?? window.innerHeight
      const headerH = Math.round(header.getBoundingClientRect().height)
      // Desktop (≥1440): bottom nav je bočno (visina ne oduzima vertikalu)
      const isDesktop = window.innerWidth >= 1440
      const measuredBottomH = Math.round(bottom.getBoundingClientRect().height)
      const bottomH = isDesktop ? 0 : measuredBottomH
      // Ako je accordion otvoren, oduzmi njegovu stvarnu visinu
      const accEl = accordionRef.current
      const accH = accEl ? Math.round(accEl.getBoundingClientRect().height) : 0
      const availableH = Math.max(viewportH - headerH - bottomH - accH, 200)
      page.style.setProperty('--bottom-real-h', `${measuredBottomH}px`)
      page.style.setProperty('--avatar-h', `${availableH}px`)
    }

    set()
    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)
    window.visualViewport?.addEventListener('resize', set)
    window.visualViewport?.addEventListener('scroll', set)
    // Promjene visine accordeona (npr. sadržaj) – promatraj i njega
    const ro = new ResizeObserver(() => set())
    if (accordionRef.current) ro.observe(accordionRef.current)

    return () => {
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
      window.visualViewport?.removeEventListener('resize', set)
      window.visualViewport?.removeEventListener('scroll', set)
      ro.disconnect()
    }
  }, [selectedNav])

  const navigate = useNavigate()
  const location = useLocation()
  const { sendFittingRoomCommand, connectionState } = usePixelStreaming()



  const openSkinRight = (
    location.state as { openSkinRight?: boolean } | undefined
  )?.openSkinRight

  useEffect(() => {
    if (openSkinRight) {
      setSelectedNav('Skin')
    }
  }, [openSkinRight])


  const measurements: Measurement[] = [
    { name: 'Shoulder', value: 33.3, icon: lengthIcon },
    { name: 'Chest', value: 97.1, icon: girthIcon },
    { name: 'Underchest', value: 88.9, icon: girthIcon },
    { name: 'Waist', value: 79.1, icon: girthIcon },
    { name: 'High Hip', value: 82, icon: girthIcon },
    { name: 'Low Hip', value: 91.8, icon: girthIcon },
    { name: 'Inseam', value: 72.6, icon: lengthIcon },
    { name: 'High Thigh', value: 53.6, icon: girthIcon },
    { name: 'Mid Thigh', value: 49.5, icon: girthIcon },
    { name: 'Knee', value: 35, icon: girthIcon },
    { name: 'Calf', value: 36.1, icon: girthIcon },
    { name: 'Ankle', value: 19.9, icon: girthIcon },
    { name: 'Foot Length', value: 24.4, icon: lengthIcon },
    { name: 'Foot Breadth', value: 8.9, icon: lengthIcon },
    { name: 'Bicep', value: 32.1, icon: girthIcon },
    { name: 'Forearm', value: 26.5, icon: girthIcon },
    { name: 'Wrist', value: 15.9, icon: girthIcon },
    { name: 'Shoulder to Wrist', value: 56.7, icon: lengthIcon },
    { name: 'Hand Length', value: 18.3, icon: lengthIcon },
    { name: 'Hand Breadth', value: 8.1, icon: lengthIcon },
    { name: 'Neck', value: 37.3, icon: girthIcon },
    { name: 'Head', value: 54.5, icon: girthIcon },
    { name: 'Height', value: 170.5, icon: lengthIcon }
  ]

  const controls: ControlButton[] = [
    { key: 'rotate-left', width: 60, Icon: RLeft, marginRight: 50 },
    { key: 'upload', width: 50, Icon: UploadIcon, marginRight: 25 },
    { key: 'fullscreen', width: 40, Icon: FullScreenIcon, marginRight: 25 },
    { key: 'download', width: 50, Icon: DownloadIcon, marginRight: 50 },
    { key: 'rotate-right', width: 60, Icon: RRight, marginRight: 0 },
  ]

  const navButtons: NavButton[] = [
    { key: 'Body', icon: bodyIcon, label: 'Body' },
    { key: 'Face', icon: faceIcon, label: 'Face' },
    { key: 'Skin', icon: skinIcon, label: 'Skin' },
    { key: 'Hair', icon: hairIcon, label: 'Hair' },
    { key: 'Extras', icon: extrasIcon, label: 'Extras' },
    { key: 'Save', icon: saveIcon, label: 'Save' },
  ]

  const avatarImage = selectedNav === 'Body' ? unrealFBBodyButton : avatarSrc

  const updateMorph = (morphId: number, morphName: string, value: number) => {
    console.log('updateMorph', { morphId, morphName, value })
  }

  const handleControlClick = (controlKey: string) => {
    // Update selected control state
    setSelectedControl(prev => (prev === controlKey ? null : controlKey))
    
    // Send pixel streaming commands for rotate buttons
    if (connectionState === 'connected') {
      switch (controlKey) {
        case 'rotate-left':
          sendFittingRoomCommand('rotateCamera', { direction: 'left', speed: 1 })
          console.log('Sent rotate left command')
          break
        case 'rotate-right':
          sendFittingRoomCommand('rotateCamera', { direction: 'right', speed: 1 })
          console.log('Sent rotate right command')
          break
        default:
          console.log(`Control ${controlKey} clicked - no streaming command defined`)
      }
    } else {
      console.log(`Cannot send command - connection state: ${connectionState}`)
    }
  }

  return (
    <div ref={pageRef} className={styles.page}>
      <Header
        data-app-header
        title="Your Avatar"
        variant="dark"
        onExit={() => navigate('/')}
        rightContent={(
          <button className={styles.avatarButton} onClick={() => navigate('/logged-in')} type="button">
            <img src={avatarsButton} alt="Avatars" />
          </button>
        )}
      />

      <div className={`${styles.centralWrapper} ${selectedNav ? styles.withAccordion : ''} ${selectedNav === 'Body' ? styles.accBody : ''} ${selectedNav === 'Face' ? styles.accFace : ''} ${selectedNav === 'Skin' ? styles.accSkin : ''} ${selectedNav === 'Hair' ? styles.accHair : ''} ${selectedNav === 'Extras' ? styles.accExtras : ''}`}>
        <div className={`${styles.avatarSection} ${selectedNav ? styles.avatarShifted : ''} ${selectedNav === 'Body' ? styles.bodySelected : ''} ${selectedNav === 'Face' ? styles.faceSelected : ''} ${selectedNav === 'Skin' ? styles.skinSelected : ''} ${selectedNav === 'Hair' ? styles.hairSelected : ''} ${selectedNav === 'Extras' ? styles.extrasSelected : ''}`}>
          <img src={avatarImage} alt="Avatar" className={styles.avatarImage} />

          {/* Body measurements panel positioned separately */}

          {/* Body accordion renders below in centralWrapper to preserve position */}

          <div className={styles.controlGroup}>
            {controls.map(control => (
              <button
                key={control.key}
                className={`${styles.controlButton} ${styles[control.key.replace('-', '')]} ${selectedControl === control.key ? styles.selected : ''}`}
                /* style={{ width: control.width, marginRight: control.marginRight, height: control.width }} */
                onClick={() => handleControlClick(control.key)}
                type="button"
              >
                <div className={styles.outerCircle} />
                <control.Icon className={styles.controlIcon} />
              </button>
            ))}
          </div>
        </div>

        {selectedNav === 'Body' && (
          <div className={styles.dataPanelWrapper}>
            <DataPanel title="Body Measurements (cm)" measurements={measurements} />
          </div>
        )}
      </div>
      {selectedNav === 'Body' && (
        <div ref={accordionRef} className={styles.accordion}>
          <BodyAccordion updateMorph={updateMorph} />
        </div>
      )}

      {selectedNav === 'Face' && (
        <div ref={accordionRef} className={styles.accordion}>
          <FaceAccordion />
        </div>
      )}

      {selectedNav === 'Skin' && (
        <div ref={accordionRef} className={styles.accordion}>
          <SkinAccordion defaultRightExpanded={openSkinRight} />
        </div>
      )}

      {selectedNav === 'Hair' && (
        <div ref={accordionRef} className={styles.accordion}>
          <HairAccordion />
        </div>
      )}

      {selectedNav === 'Extras' && (
        <div ref={accordionRef} className={styles.accordion}>
          <ExtrasAccordion />
        </div>
      )}

      <div ref={bottomRef} className={styles.bottomSection}>
        <div className={styles.bottomNav}>
          {navButtons.map(btn => (
            <button
              key={btn.key}
              className={`${styles.navButton} ${selectedNav === btn.key ? styles.active : ''}`}
              onClick={() =>
                setSelectedNav(prev => (prev === btn.key ? null : btn.key))
              }
              type="button"
            >
              <div className={styles.navIndicator} />
              <div className={styles.navIcon}>
                <img src={btn.icon} alt={btn.label} />
              </div>
              <span className={styles.navLabel}>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
