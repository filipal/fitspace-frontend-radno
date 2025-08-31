const oidcConfig = {
  // Use the user-pool issuer which exposes the OIDC discovery document
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_0cK7yNVJr",
  client_id: "35gs2safccnf49vo9d7ubqv65o",
  // Explicit redirect URI must match the Callback URL configured in Cognito
  redirect_uri: "http://localhost:5173/login",
  response_type: "code",
  scope: "openid email phone",
}

export default oidcConfig