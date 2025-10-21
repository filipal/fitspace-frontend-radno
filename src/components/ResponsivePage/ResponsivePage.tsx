import type { ReactNode, HTMLAttributes } from 'react'
import styles from './ResponsivePage.module.scss'

type SlotContent = ReactNode | null | undefined

export interface ResponsivePageProps extends HTMLAttributes<HTMLDivElement> {
  header?: SlotContent
  footer?: SlotContent
  contentClassName?: string
  bodyClassName?: string
  /** NEW: kad je true, header/body/footer dobiju inner wrap s max-width umjesto centriranja cijelog bloka */
  useInnerContainers?: boolean
  /** NEW: širina inner kontejnora (kad je useInnerContainers) */
  desktopMaxWidth?: number // npr. 1440
}

export default function ResponsivePage({
  header,
  footer,
  contentClassName,
  bodyClassName,
  children,
  className,
  useInnerContainers = false,     // ⟵ default false => login ostaje isti
  desktopMaxWidth = 1440,
  ...rest
}: ResponsivePageProps) {
  const outerClass = className ? `${styles.page} ${className}` : styles.page
  const bodyClass = bodyClassName ? `${styles.body} ${bodyClassName}` : styles.body
  const innerClass = contentClassName
    ? `${styles.canvasInner} ${contentClassName}`
    : styles.canvasInner

  return (
    <div className={outerClass} style={{ '--fs-desktop-width': `${desktopMaxWidth}px`, ...rest.style }} {...rest}>
      {header ? (
        <div className={styles.header}>
          {useInnerContainers ? <div className={styles.headerInner}>{header}</div> : header}
        </div>
      ) : null}

      <div className={bodyClass}>
        {useInnerContainers ? (
          <div className={styles.bodyInner}>
            <div className={styles.canvas}>
              <div className={innerClass}>{children}</div>
            </div>
          </div>
        ) : (
          <div className={styles.canvas}>
            <div className={innerClass}>{children}</div>
          </div>
        )}
      </div>
      {footer ? (
        <div className={styles.footer}>
          {useInnerContainers ? <div className={styles.footerInner}>{footer}</div> : footer}
        </div>
      ) : null}
    </div>
  )
}