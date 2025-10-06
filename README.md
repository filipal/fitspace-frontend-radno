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

### Run the bundled backend locally

The repository includes a snapshot of the Flask backend under
`backend-copy/`. To start it in development mode run:

```bash
cd backend-copy
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py  # exposes the API on http://localhost:8080/
```

If you prefer using the Flask CLI instead of invoking the script directly,
activate the virtual environment and run:

```bash
export FLASK_APP=app.py
flask run --host=0.0.0.0 --port=8080 --debug
```

```

> 💡 **Napomena za macOS / Python 3.13**: `psycopg2-binary` trenutno ne
> objavljuje gotove wheel pakete za Python 3.13, zbog čega instalacija može
> preskočiti ovaj paket bez greške, a pokretanje aplikacije završiti porukom
> `ModuleNotFoundError: No module named 'psycopg2'`. Ako naiđete na tu poruku:
>
> 1. Provjerite da je virtualno okruženje aktivno (`which python` treba
>    pokazivati u `.venv`).
> 2. Pokrenite `python --version` i, ako je verzija 3.13, preporučujemo
>    instalaciju Python 3.11 ili 3.12 (npr. preko `pyenv`) te ponavljanje
>    koraka iznad.
> 3. Alternativno, ručno instalirajte paket iz izvornog koda unutar virtualnog
>    okruženja naredbom `pip install psycopg2-binary` nakon što imate sve
>    potrebne sustavske biblioteke (na macOS-u to obično zahtijeva
>    `brew install postgresql`).

Both approaches serve the API on port `8080`. Update your frontend `.env`
file so `VITE_API_BASE_URL` points to `http://localhost:8080/api` and
`VITE_AVATAR_API_BASE_URL` to `http://localhost:8080/api/users/` when testing
against the local backend.

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
`VITE_AVATAR_API_BASE_URL` **mora** završavati s `/api/users/` kako bi frontend
mogao dodati identifikator korisnika na kraj putanje.

Ako avatar servis podržava API ključ, postavite ga kao opcionalnu varijablu
`VITE_AVATAR_API_KEY`.

After updating the environment file, restart the Vite development server so the
new value is picked up in `import.meta.env`.

Redoslijed naredbi
U korijenskom direktoriju projekta izvedi sljedeće korake redom:
1. kreiraj virtualno okruženje
python3 -m venv venv 
2. aktiviraj ga prije daljnjeg rada
source venv/bin/activate 
3. nstaliraj ovisnosti, uključujući psycopg2-binary
pip install -r requirements.txt 
1. postavi varijablu okoline na svoju PostgreSQL instancu
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fitspace"

5. primijeni shemu kako bi se kreirale potrebne tablice i ograničenja.
psql "$DATABASE_URL" -f db/schema.sql 
6. pripremi Flask CLI da zna koju aplikaciju treba učitati
export FLASK_APP=app.py 
7. pokreni razvojni poslužitelj u debug modu
flask run --host=0.0.0.0 --port=8080 --debug
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