kod za tsx

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
  const pageRef = useRef<HTMLDivElement | null>(null);

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

  const navigate = useNavigate()
  const location = useLocation()
  const { sendFittingRoomCommand, connectionState } = usePixelStreaming()

  const [selectedControl, setSelectedControl] = useState<string | null>(null)
  const [selectedNav, setSelectedNav] = useState<NavKey | null>(null)
  const [avatarSrc] = useState<string>(avatarMeasure)

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
        title="Your Avatar"
        variant="dark"
        onExit={() => navigate('/')}
        rightContent={(
          <button className={styles.avatarButton} onClick={() => navigate('/logged-in')} type="button">
            <img src={avatarsButton} alt="Avatars" />
          </button>
        )}
      />

      <div className={`${styles.centralWrapper} ${selectedNav ? styles.withAccordion : ''}`}>
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
        <div className={styles.accordion}>
          <BodyAccordion updateMorph={updateMorph} />
        </div>
      )}

      {selectedNav === 'Face' && (
        <div className={styles.accordion}>
          <FaceAccordion />
        </div>
      )}

      {selectedNav === 'Skin' && (
        <div className={styles.accordion}>
          <SkinAccordion defaultRightExpanded={openSkinRight} />
        </div>
      )}

      {selectedNav === 'Hair' && (
        <div className={styles.accordion}>
          <HairAccordion />
        </div>
      )}

      {selectedNav === 'Extras' && (
        <div className={styles.accordion}>
          <ExtrasAccordion />
        </div>
      )}

      <div className={styles.bottomSection}>
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

Kod za scss

@use '../styles' as s;
$design-w: 430; // jedan izvor istine

@function cqw($px, $base: $design-w) {
  @return calc((#{$px} / #{$base}) * 100cqw); 
}

@function fsz($n, $minFactor: .85) {
  @return clamp(#{$n * $minFactor}px, cqw(#{$n}), #{$n}px);
}

:root {
  --design-w: #{$design-w};
  --design-h: 932;   /* visina dizajna (broj, bez px) */
  --header-h: 101;   /* visina headera (broj, bez px); stavi 0 ako ga nema */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
.page {
  /* omogućuje cqw mjere u odnosu na širinu ove stranice */
  container-type: inline-size;
  position: relative;   /* ⟵ referenca za apsolutno pozicioniranje */
  width: 100%;
  max-width: calc(var(--design-w) * 1px);
  min-height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #000;
  background: #ececec;
  --page-w-px: 100cqw;
  container-name: page;
  /* nasljeđivanje fonta i na form-kontrole */
  button, input, select, textarea { font: inherit; }
}

.centralWrapper {
  /* var za visinu accordeona (0 dok je zatvoren) */
  --acc-h: 0;
  position: static;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.withAccordion { --acc-h: cqw(171); }

.avatarSection {
  width: 100%;
  height: calc(#{cqw(750)} - var(--acc-h, 0));
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.avatarButton {
  inline-size: calc((32 / 430) * var(--page-w-px)); /* 32px @430 */
  block-size:  calc((32 / 430) * var(--page-w-px));
  padding: 0;
  border: 0;
  background: transparent;
  display: grid;
  place-items: center;
  flex: 0 0 auto; /* ne rasteži u header flexu */
}
.avatarButton img{
  inline-size: 100%;
  block-size:  100%;
  object-fit: contain;
  display: block;
}

/* osiguraj minimalni tap-target na manjim širinama */
@container page (max-width: 400px){
  .avatarButton{
    min-inline-size: 28px;
    min-block-size:  28px;
  }
}

/* —— DATA PANEL POZICIJA I DIMENZIJE —— */
/* Wrapper određuje točnu kutiju 180×495 i poziciju 10/10 od stranice */
.dataPanelWrapper {
  position: absolute;
  /* 10px ispod headera (realna visina), skalirano po širini stranice */
  top: calc(
    var(--header-real-h, calc(var(--header-h, 0) * 1px))
    + (10 / 430) * var(--page-w-px)
  );
  left: calc((10 / 430) * var(--page-w-px));
  inline-size: calc((180 / 430) * var(--page-w-px));
  block-size:  calc((495 / 430) * var(--page-w-px));
  z-index: 2;
}

.bodySelected {
  height: cqw(579);
  justify-content: flex-end;
}
@container page (max-width: 400px){
  .dataPanelWrapper{
    /* umjesto +10px (skalirano), koristi +6px (skalirano) */
    top: calc(var(--header-h, 0) * 1px + (-3 / 430) * var(--page-w-px));
    /* po želji: i lijevi odmak mrvu manji */
    /* left: calc((8 / 430) * var(--page-w-px)); */
  }
}

/* Background strip behind DataPanel when Body is selected */
.bodySelected::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: cqw(156);
  background: #BAB9BA;
  z-index: 0;
  pointer-events: none;
}

.bodySelected .avatarImage {
  width: cqw(274);
  height: cqw(579);
}

.avatarImage {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Face mode: show top-cropped/zoomed view at 430x670 */
.faceSelected {
  height: cqw(670);
  --avatar-zoom: 2.4;
  overflow: hidden;
}
.faceSelected .avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  transform: scale(var(--avatar-zoom, 1));
  transform-origin: top center;
  will-change: transform;
}

/* Skin mode */
.skinSelected {
  height: cqw(690);
  overflow: hidden;
  --avatar-zoom: 1.0;
  background: #BAB9BA;
}
.skinSelected .avatarImage {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(var(--avatar-zoom, 1));
  transform-origin: center bottom;
}

/* Hair mode */
.hairSelected {
  height: cqw(630);
  overflow: hidden;
  --avatar-zoom: 2.4;
}
.hairSelected .avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  transform: scale(var(--avatar-zoom, 1));
  transform-origin: top center;
  will-change: transform;
}

/* Extras mode */
.extrasSelected {
  height: cqw(630);
  overflow: hidden;
  --avatar-zoom: 2.4;
}
.extrasSelected .avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  transform: scale(var(--avatar-zoom, 1));
  transform-origin: top center;
  will-change: transform;
}

.accordion {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 !important;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

/* Kontrole ispod avatara */
.controlGroup {
  position: absolute;
  bottom: cqw(10);
  left: 50%;
  transform: translateX(-50%);
  width: cqw(410);
  height: cqw(60);
  display: flex;
  align-items: flex-end;
  z-index: 3;
}

.controlButton {
  position: relative;
  border: none;
  padding: 0;
  background: none;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s ease;
  color: #FFFFFF;
}
.controlButton svg { display: block; }
.controlButton svg .outerHalo { transition: fill .2s ease; }
.controlButton.selected svg .outerHalo { fill: #000; fill-opacity: 1; }
.controlButton svg .whiteRing { shape-rendering: geometricPrecision; }

.controlIcon { width: 100%; height: 100%; object-fit: contain; }
.controlButton .outerCircle { display: none; }
.controlButton.selected { color: #FFFFFF; }

.controlIcon { position: relative; z-index: 2; }
.outerCircle {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: cqw(2) solid #FFFFFF;
  background: transparent;
  box-sizing: border-box;
  transition: border-color .25s ease;
  z-index: 1;
  pointer-events: none;
}
.controlButton.selected .outerCircle { border-color: #000; }

/* pojedinačne širine/razmaci ikona */
.rotateleft  { width: cqw(60); margin-right: cqw(50); }
.upload      { width: cqw(50); margin-right: cqw(25); }
.fullscreen  { width: cqw(40); margin-right: cqw(25); }
.download    { width: cqw(50); margin-right: cqw(50); }
.rotateright { width: cqw(60); }

/* Bottom nav sekcija */
.bottomSection {
  width: 100%;
  max-width: 430px;
  border-top: 1px solid #000; /* border ostavi 1px zbog oštrine */
  display: flex;
  justify-content: center;
  /* margin-bottom: cqw(20); */
  padding-top: 0;
  background: #ececec;
  position: relative;
}
.bottomSection::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  bottom: calc(-1 * cqw(20));
  height: cqw(20);
  background: #ececec;
  z-index: 0;
  pointer-events: none;
}

.bottomNav {
  width: 100%;
  max-width: cqw(410);
  height: cqw(60);
  display: flex;
}

.navButton {
  width: cqw(60);
  height: cqw(60);
  padding: 0;
  border: none;
  background: none;
  /* -webkit-appearance: none;  iOS: ne bojaj tekst kao link/gumb */
  color: #000;              /* fiksiraj boju teksta na iOS-u */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
}

.navButton:not(:first-child) {
  margin-left: cqw(10);
}

.navIndicator {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: cqw(5);
  display: none;
}
.active .navIndicator { background: #000; display: block; }

.navIcon {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: cqw(35);
  order: 2;
  margin-bottom: cqw(2);
}
.navIcon img {
  max-width: cqw(42);
  max-height: cqw(31);
  width: auto;
  height: auto;
}

.navLabel {
  height: cqw(20);
  font-size: clamp(12px, cqw(14), 16px);
  color: inherit;           /* naslijedi crnu iz .navButton */
  white-space: nowrap;      /* izbjegni lom teksta u širinu */
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;  /* zaštita od prelijevanja (crveni outline) */
  display: flex;
  align-items: center;
  justify-content: center;
  order: 3;
}

/* —— desktop layout ostaje kako je —— */
@include s.respond(xxl) {
  .page {
    width: var(--page-width);
    max-width: var(--page-max-width);
    height: 100svh;
    align-items: flex-start;
    position: relative;
  }
  .centralWrapper {
    flex-direction: row;
    align-items: flex-start;
    width: calc(100% - 90px);
    height: calc(100% - 70px);
    justify-content: center;
    padding-left: 0;
    margin-bottom: cqw(9);
    background: #B1B1B0;
  }
  .centralWrapper.withAccordion { width: calc(100% - 90px - 335px); justify-content: flex-start; }
  .avatarShifted { margin-left: 123px; }
  .avatarSection { width: 604px; height: 953px; }
  .bodySelected { height: 953px; justify-content: center; }
  .bodySelected::before { display: none; }
  .bodySelected .avatarImage { width: 100%; height: 100%; }
  .dataPanelWrapper { position: static; width: 273px; height: 774px; margin-left: 15px; margin-right: 22px; margin-top: 62px; }
  .accordion { width: 335px; height: calc(100% - 70px); position: absolute; top: 70px; right: 90px; }
  .bottomSection {
    position: absolute; top: 70px; right: 0; width: 90px; height: calc(100% - 70px);
    border-top: none; border-left: 1px solid #000; margin-bottom: 0; justify-content: flex-start;
  }
  .bottomSection::after { display: none; }
  .bottomNav { width: 90px; height: 100%; flex-direction: column; margin-top: 0; align-items: center; }
  .navIndicator { top: 0; bottom: 0; left: 0; right: auto; width: 5px; height: 100%; }
  .navButton { width: 90px; height: 90px; }
  .navButton:not(:first-child) { margin-left: 0; margin-top: 10px; }
}

@include s.respond(lg) { /* (po potrebi) */ }
