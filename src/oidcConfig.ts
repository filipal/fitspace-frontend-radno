import { WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts'

const redirectUri =
  import.meta.env.VITE_COGNITO_REDIRECT_URI ?? `${window.location.origin}/auth/callback`

const postLogoutRedirectUri =
  import.meta.env.VITE_COGNITO_LOGOUT_URI ?? `${window.location.origin}/`

const authority =
  import.meta.env.VITE_COGNITO_ISSUER
  ?? `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/${
    import.meta.env.VITE_COGNITO_USER_POOL_ID ?? 'eu-north-1_0cK7yNVJr'
  }`

/**
 * Napomena za scope:
 * - drži default minimalan ('openid email')
 * - ako trebaš i 'profile' ili 'phone', postavi u .env: VITE_COGNITO_SCOPES="openid email profile phone"
 */
const oidcConfig: UserManagerSettings = {
  authority,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '35gs2safccnf49vo9d7ubqv65o',
  redirect_uri: redirectUri,
  post_logout_redirect_uri: postLogoutRedirectUri,
  response_type: 'code', // PKCE
  scope: import.meta.env.VITE_COGNITO_SCOPES ?? 'openid email',

  // “Mobile-friendly”/stabilnije ponašanje kod redirecta:
  automaticSilentRenew: true,
  loadUserInfo: true,

  // Spremaj korisnika u localStorage (umjesto default sessionStorage) — robusnije za redirect tab flow
  ...(typeof window !== 'undefined'
    ? { userStore: new WebStorageStateStore({ store: window.localStorage }) }
    : {}),
}

export default oidcConfig
