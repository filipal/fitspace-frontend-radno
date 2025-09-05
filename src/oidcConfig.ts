const oidcConfig = {
  // Use the user-pool issuer which exposes the OIDC discovery document
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_0cK7yNVJr",
  client_id: "35gs2safccnf49vo9d7ubqv65o",
  // Dinamički redirect URI: koristi trenutačni origin (port) + /login
  // Obavezno dodaj ovaj URL u Cognito App Client Callback URLs.
  redirect_uri: `${window.location.origin}/login`,
  // Nakon odjave vrati korisnika na početnu (ili po želji drugu rutu)
  // Dodaj ovaj URL u Cognito Allowed Sign-out URLs.
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: "code",
  scope: "openid email phone",
}

export default oidcConfig
