// src/oidcConfig.ts
const redirectUri =
  import.meta.env.VITE_COGNITO_REDIRECT_URI || `${window.location.origin}/auth/callback`;

const postLogoutRedirectUri =
  import.meta.env.VITE_COGNITO_LOGOUT_URI || `${window.location.origin}/`;

const authority =
  import.meta.env.VITE_COGNITO_ISSUER ||
  // issuer je user-pool OIDC endpoint (Cognito će preko njega dati discovery doc)
  `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID || 'eu-north-1_0cK7yNVJr'}`;

const oidcConfig = {
  authority,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID || '35gs2safccnf49vo9d7ubqv65o',
  redirect_uri: redirectUri,
  post_logout_redirect_uri: postLogoutRedirectUri,
  response_type: 'code', // PKCE
  scope: import.meta.env.VITE_COGNITO_SCOPES || 'openid email',
};

export default oidcConfig;
