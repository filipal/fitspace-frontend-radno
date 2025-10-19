import type { AuthContextProps } from 'react-oidc-context'
import type { SigninRedirectArgs } from 'oidc-client-ts'
import oidcConfig from '../oidcConfig'

/* ────────────────────────────────────────────────────────────────────────────
   Hosted UI helperi
   ──────────────────────────────────────────────────────────────────────────── */
export type HostedUiProvider =
  | 'Google'
  | 'Facebook'
  | 'SignInWithApple'
  | (string & {}) // dopušta custom naziv iz Cognita

/** Pripremi opcije za auth.signinRedirect s identity_provider parametrom */
export const buildProviderSigninArgs = (
  provider: HostedUiProvider,
  extra?: SigninRedirectArgs
): SigninRedirectArgs => ({
  ...(extra ?? {}),
  extraQueryParams: {
    ...(extra?.extraQueryParams ?? {}),
    identity_provider: provider,
  },
})

/** Gumbi */
export const loginWithGoogle = (auth: AuthContextProps, extra?: SigninRedirectArgs) =>
  auth.signinRedirect(buildProviderSigninArgs('Google', extra))

export const loginWithFacebook = (auth: AuthContextProps, extra?: SigninRedirectArgs) =>
  auth.signinRedirect(buildProviderSigninArgs('Facebook', extra))

export const loginWithApple = (auth: AuthContextProps, extra?: SigninRedirectArgs) =>
  auth.signinRedirect(buildProviderSigninArgs('SignInWithApple', extra))

/** Logout preko Hosted UI-a */
export const logoutToHostedUi = (auth: AuthContextProps) =>
  auth.signoutRedirect({ post_logout_redirect_uri: oidcConfig.post_logout_redirect_uri })

const buildHostedLogoutUrl = () => {
  if (typeof window === 'undefined') return undefined

  const domain = import.meta.env.VITE_COGNITO_DOMAIN
  if (!domain) return undefined

  const logoutUri = (oidcConfig.post_logout_redirect_uri ?? `${window.location.origin}/`) as string
  const clientId = oidcConfig.client_id as string | undefined

  if (!clientId) return undefined

  try {
    const url = new URL('/logout', domain)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('logout_uri', logoutUri)
    return url
  } catch (err) {
    console.error('Failed to build Hosted UI logout URL', err)
    return undefined
  }
}

/**
 * Pokušaj "tihog" Cognito odjavljivanja u pozadini kako bi korisnik ostao na aplikaciji.
 * Vraća true ako je zahtjev uspješno iniciran (bez obzira na ishod), false ako nije bilo moguće.
 */
export const triggerHostedLogoutSilently = () => {
  const logoutUrl = buildHostedLogoutUrl()
  if (!logoutUrl || typeof document === 'undefined') return false

  const body = document.body
  if (!body) return false

  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'absolute'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove()
      }, 0)
    }

    iframe.addEventListener('load', cleanup, { once: true })
    iframe.addEventListener('error', cleanup, { once: true })
    iframe.src = logoutUrl.toString()

    body.appendChild(iframe)
    return true
  } catch (err) {
    console.error('Failed to trigger silent Hosted UI logout', err)
    return false
  }
}

/** Očisti query/hash iz URL-a nakon callback-a (bez reloada) */
export const cleanCallbackUrl = () => {
  window.history.replaceState({}, document.title, window.location.pathname)
}

/* ────────────────────────────────────────────────────────────────────────────
   (Opcionalno) Direct URL helper — koristi samo ako baš treba mimo OIDC klijenta
   ──────────────────────────────────────────────────────────────────────────── */
export const createDirectAuthUrl = (provider: HostedUiProvider): string => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN
  if (!domain) {
    throw new Error(
      'VITE_COGNITO_DOMAIN nije postavljen. Preporuka: koristite auth.signinRedirect() helpere.'
    )
  }

  // Fallback vrijednosti kako TypeScript ne bi prigovarao na “string | undefined”
  const clientId = oidcConfig.client_id as string
  const responseType = (oidcConfig.response_type ?? 'code') as string
  const scope = (oidcConfig.scope ?? 'openid email') as string
  const redirectUri = (oidcConfig.redirect_uri ??
    `${window.location.origin}/auth/callback`) as string

  const url = new URL('/oauth2/authorize', domain)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', responseType)
  url.searchParams.set('scope', scope)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('identity_provider', provider)
  return url.toString()
}