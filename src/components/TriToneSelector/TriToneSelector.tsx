import { useEffect, useMemo, useState, type CSSProperties, type ComponentType, type SVGProps } from 'react'
import styles from './TriToneSelector.module.scss'

type Orientation = 'horizontal' | 'vertical'

type ClassTuple = [string | undefined, string | undefined, string | undefined]

interface TriToneSelectorProps {
  icons: [
    ComponentType<SVGProps<SVGSVGElement>>,
    ComponentType<SVGProps<SVGSVGElement>>,
    ComponentType<SVGProps<SVGSVGElement>>,
  ]
  colors: [string, string, string]
  selectedIndex?: number | null
  defaultIndex?: number
  onSelect?: (index: number) => void
  className?: string
  interactive?: boolean
  orientation?: Orientation
  responsiveOrientation?: {
    breakpoint: number
    above: Orientation
    below?: Orientation
  }
  style?: CSSProperties
  collapseToSelected?: boolean
  buttonClassName?: string
  buttonClassNames?: ClassTuple
  collapsedButtonClassName?: string
  iconClassName?: string
  iconClassNames?: ClassTuple
  collapsedIconClassName?: string
}

const classList = (...tokens: Array<string | false | null | undefined>) =>
  tokens.filter(Boolean).join(' ')

export function TriToneSelector({
  icons,
  colors,
  selectedIndex = null,
  defaultIndex = 1,
  onSelect,
  className,
  interactive = true,
  orientation = 'horizontal',
  responsiveOrientation,
  style,
  collapseToSelected = false,
  buttonClassName,
  buttonClassNames,
  collapsedButtonClassName,
  iconClassName,
  iconClassNames,
  collapsedIconClassName,
}: TriToneSelectorProps) {
  const resolvedIndex = selectedIndex ?? defaultIndex ?? 0

  const [currentOrientation, setCurrentOrientation] = useState<Orientation>(orientation)

  useEffect(() => {
    if (!responsiveOrientation) {
      setCurrentOrientation(orientation)
      return
    }

    if (typeof window === 'undefined' || !window.matchMedia) {
      setCurrentOrientation(orientation)
      return
    }

    const { breakpoint, above, below = orientation } = responsiveOrientation
    const media = window.matchMedia(`(min-width: ${breakpoint}px)`)

    const apply = (matches: boolean) => {
      setCurrentOrientation(matches ? above : below)
    }

    apply(media.matches)

    const handler = (event: MediaQueryListEvent) => apply(event.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    }

    media.addListener(handler)
    return () => media.removeListener(handler)
  }, [responsiveOrientation, orientation])

  const shouldCollapse = collapseToSelected && selectedIndex != null

  const indicesToRender = useMemo(() => {
    if (shouldCollapse && selectedIndex != null) {
      return [selectedIndex]
    }
    return [0, 1, 2]
  }, [shouldCollapse, selectedIndex])

  const orientationClass = currentOrientation === 'vertical' ? styles.vertical : styles.horizontal

  return (
    <div
      className={classList(
        styles.root,
        orientationClass,
        className,
        !interactive && styles.nonInteractive,
        shouldCollapse && styles.collapsed,
      )}
      style={{
        ...style,
        '--tri-tone-direction': currentOrientation === 'vertical' ? 'column' : 'row',
      } as CSSProperties}
      data-orientation={currentOrientation}
      data-collapsed={shouldCollapse ? 'true' : undefined}
    >
      {indicesToRender.map((idx) => {
        const Icon = icons[idx]
        const baseColor = colors[idx]
        const isActive = resolvedIndex === idx

        return (
          <button
            key={idx}
            type="button"
            className={classList(
              styles.iconButton,
              buttonClassName,
              buttonClassNames?.[idx],
              shouldCollapse && collapsedButtonClassName,
            )}
            onClick={() => {
              if (!interactive) return
              if (!onSelect) return
              onSelect(idx)
            }}
            aria-pressed={isActive}
            data-index={idx}
            data-active={isActive ? 'true' : undefined}
          >
            <Icon
              className={classList(
                styles.iconGraphic,
                iconClassName,
                iconClassNames?.[idx],
                shouldCollapse && collapsedIconClassName,
              )}
              style={{ color: baseColor }}
              data-active={isActive ? 'true' : undefined}
            />
          </button>
        )
      })}
    </div>
  )
}

export default TriToneSelector