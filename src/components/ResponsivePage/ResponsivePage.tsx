import type { ReactNode, HTMLAttributes } from 'react'
import styles from './ResponsivePage.module.scss'

type SlotContent = ReactNode | null | undefined

export interface ResponsivePageProps extends HTMLAttributes<HTMLDivElement> {
  header?: SlotContent
  footer?: SlotContent
  contentClassName?: string
  bodyClassName?: string
}

export default function ResponsivePage({
  header,
  footer,
  contentClassName,
  bodyClassName,
  children,
  className,
  ...rest
}: ResponsivePageProps) {
  const outerClass = className ? `${styles.page} ${className}` : styles.page
  const bodyClass = bodyClassName ? `${styles.body} ${bodyClassName}` : styles.body
  const innerClass = contentClassName
    ? `${styles.canvasInner} ${contentClassName}`
    : styles.canvasInner

  return (
    <div className={outerClass} {...rest}>
      {header ? <div className={styles.header}>{header}</div> : null}

      <div className={bodyClass}>
        <div className={styles.canvas}>
          <div className={innerClass}>{children}</div>
        </div>
      </div>

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  )
}