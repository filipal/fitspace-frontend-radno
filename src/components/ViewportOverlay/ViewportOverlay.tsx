import { useEffect, useState } from 'react'

export function ViewportOverlay() {
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: 0,
    top: 0,
    width: '0px',
    height: '0px',
    border: '2px solid red',
    boxSizing: 'border-box',
    pointerEvents: 'none', // ne blokira klikove
    zIndex: 999999,        // iznad appa, ispod devtools
    backgroundColor: 'rgba(255,0,0,0.05)',
    color: 'red',
    fontFamily: 'monospace',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '4px',
  })

  const [label, setLabel] = useState('…')

  useEffect(() => {
    function update() {
      const vv = window.visualViewport
      const visibleHeight = vv?.height ?? window.innerHeight
      const visibleWidth = vv?.width ?? window.innerWidth
      const offsetLeft = vv?.offsetLeft ?? 0
      const offsetTop = vv?.offsetTop ?? 0

      // stil boxa (kutija koja crta “stvarno vidljivo”)
      setBoxStyle(prev => ({
        ...prev,
        width: visibleWidth + 'px',
        height: visibleHeight + 'px',
        left: offsetLeft + 'px',
        top: offsetTop + 'px',
      }))

      // labela u kutu
      setLabel(
        `visible ${Math.round(visibleWidth)}×${Math.round(
          visibleHeight
        )} px @ dpr ${window.devicePixelRatio}`
      )

      // BONUS: CSS varijable za layout (možeš koristiti u SCSS-u)
      document.documentElement.style.setProperty(
        '--app-visible-height',
        visibleHeight + 'px'
      )
      document.documentElement.style.setProperty(
        '--app-visible-width',
        visibleWidth + 'px'
      )
    }

    update()

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update)
      window.visualViewport.addEventListener('scroll', update)
    }

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
        window.visualViewport.removeEventListener('scroll', update)
      }
    }
  }, [])

  return (
    <div style={boxStyle}>
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '2px 4px',
          borderRadius: '3px',
          fontSize: '10px',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  )
}
