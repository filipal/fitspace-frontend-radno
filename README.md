# FitSpace Frontend

This repository contains the React + TypeScript source for the FitSpace demo application built with [Vite](https://vitejs.dev/). The app provides a simple login page that routes to an avatar management screen.

## Getting Started

### Install dependencies

## Expanding the ESLint configuration
```bash
npm install
```

### Run the development server
```bash
npm run dev
```
The dev server runs on Vite's default port, usually `http://localhost:5173/`.

### Configure environment variables

The frontend communicates with the FitSpace backend in two steps:

1. It first requests a short-lived backend JWT by calling
   `POST {VITE_API_BASE_URL}/auth/token` with the signed-in user's Cognito
   identifiers and refresh token.
2. It then uses that backend token (together with the Cognito session headers)
   when calling the avatar endpoints under `VITE_AVATAR_API_BASE_URL`.

Copy `.env.example` to `.env` and configure at least the following keys:

```bash
cp .env.example .env
```

Then edit `.env` so that it contains at least:

```dotenv
VITE_API_BASE_URL=https://backend.example.com/api
VITE_AVATAR_API_BASE_URL=https://backend.example.com/api/users/
```
If your backend protects the `/auth/token` endpoint with an API key, also set
`VITE_AVATAR_API_KEY`.

After updating the environment file, restart the Vite development server so the
new value is picked up in `import.meta.env`.


### Build for production
```bash
npm run build
```

The compiled output is placed in the `dist` directory.

### Lint the project
```bash
npm run lint
```

Running this command checks the project with ESLint.

### Page dimensions

The CSS custom properties `--page-max-width` and `--page-height` in
`src/index.css` provide the base page dimensions. They default to `360px`
by `800px` and are progressively overridden at viewport widths of `430px`,
`768px`, `1024px`, `1280px`, and `1440px` so page modules can read consistent
sizes across breakpoints.

## Debug Mode

The application includes a debug mode for development and testing purposes.

### How to Use
- **URL Parameter**: Visit any page with `?debug=true` (e.g., `http://localhost:5173/?debug=true`)
- **Keyboard Shortcut**: Press `Ctrl+Shift+D` anywhere in the app
- **Close**: Click the ✕ button or press `Ctrl+Shift+D` again

The debug overlay displays pixel streaming debug information and can be extended with additional debugging tools as needed.

npm install react-oidc-context  