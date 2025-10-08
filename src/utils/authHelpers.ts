import type { AuthContextProps } from 'react-oidc-context'
import type { SigninRedirectArgs } from 'oidc-client-ts'
import oidcConfig from '../oidcConfig'

/* ────────────────────────────────────────────────────────────────────────────
   Provider helperi — preporučeni put (koristi postojeći OIDC klijent)
   Cognito Hosted UI očekuje identity_provider nazive koji odgovaraju
   konfiguraciji u User Poolu (tipično: Google, Facebook, SignInWithApple).
   ──────────────────────────────────────────────────────────────────────────── */
export type HostedUiProvider =
  | 'Google'
  | 'Facebook'
  | 'SignInWithApple'
  | (string & {}) // dozvoli custom naziv ako je drugačije imenovano u Cognitu

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

/** “Gumbi” (wrappere) koje vežeš direktno na onClick u UI-ju */
export const loginWithGoogle = (auth: AuthContextProps, extra?: SigninRedirectArgs) =>
  auth.signinRedirect(buildProviderSigninArgs('Google', extra))

export const loginWithFacebook = (auth: AuthContextProps, extra?: SigninRedirectArgs) =>
  auth.signinRedirect(buildProviderSigninArgs('Facebook', extra))

export const loginWithApple = (auth: AuthContextProps, extra?: SigninRedirectArgs) =>
  auth.signinRedirect(buildProviderSigninArgs('SignInWithApple', extra))

/** Logout preko Hosted UI-a */
export const logoutToHostedUi = (auth: AuthContextProps) =>
  auth.signoutRedirect({ post_logout_redirect_uri: oidcConfig.post_logout_redirect_uri })

/** Očisti query/hash iz URL-a nakon callback-a (bez reloada) */
export const cleanCallbackUrl = () => {
  window.history.replaceState({}, document.title, window.location.pathname)
}

/* ────────────────────────────────────────────────────────────────────────────
   (Opcionalno) Direct URL helper ako baš treba ići mimo OIDC klijenta.
   Za ovo postavi VITE_COGNITO_DOMAIN, npr.:
   https://yourprefix.auth.eu-north-1.amazoncognito.com
   ──────────────────────────────────────────────────────────────────────────── */
export const createDirectAuthUrl = (provider: HostedUiProvider): string => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN
  if (!domain) {
    throw new Error(
      'VITE_COGNITO_DOMAIN nije postavljen. Preporuka: koristite auth.signinRedirect() helpere.'
    )
  }
  const url = new URL('/oauth2/authorize', domain)
  url.searchParams.set('client_id', oidcConfig.client_id)
  url.searchParams.set('response_type', oidcConfig.response_type)
  url.searchParams.set('scope', oidcConfig.scope)
  url.searchParams.set('redirect_uri', oidcConfig.redirect_uri)
  url.searchParams.set('identity_provider', provider)
  return url.toString()
}