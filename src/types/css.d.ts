import 'react'

declare module 'react' {
  // dopusti bilo koji CSS custom property: --something
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}