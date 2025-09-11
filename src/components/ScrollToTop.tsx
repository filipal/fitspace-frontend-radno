import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Always scrolls window to top on route changes.
 * Works for push, replace and back/forward (POP) navigation.
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    // If there is a hash, try scrolling to the element; otherwise scroll to top
    if (hash) {
      const id = hash.slice(1)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView()
        return
      }
    }

    // Reset window scroll position
    // Use both APIs for broader browser support
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.body.scrollTop = 0
    document.documentElement.scrollTop = 0
  }, [pathname, search, hash])

  return null
}

