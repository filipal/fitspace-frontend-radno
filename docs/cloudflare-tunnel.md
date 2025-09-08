Cloudflare Tunnel za mobilni dev (HTTPS)

Zašto: Login (Cognito/PKCE) i kamera (getUserMedia) rade samo na HTTPS ili localhost. Tunel daje javni HTTPS URL tvog lokalnog Vite servera koji možeš otvoriti na iPhone/Android uređajima.

Prerekviziti
- macOS: `brew install cloudflared`
- Pokrenut lokalni dev: `npm run dev` (sluša na http://localhost:5177)

Opcija 1 — Quick Tunnel (najbrže)
1) U jednom terminalu: `npm run dev`
2) U drugom terminalu: `npm run dev:tunnel`
3) Cloudflared ispiše URL oblika `https://<nasumično>.trycloudflare.com`
4) Otvori taj URL na telefonu (HTTPS) — login i kamera će raditi
5) Cognito Hosted UI → dodaj URL-ove:
   - Allowed callback: `https://<nasumično>.trycloudflare.com/login`
   - Allowed sign-out: `https://<nasumično>.trycloudflare.com/`

Napomena: domena se mijenja pri svakom pokretanju. Za stabilni URL koristi “Named Tunnel”.

Opcija 2 — Named Tunnel (stalan poddomen)
Pretpostavka: domena je u Cloudflareu (DNS managed by Cloudflare)

1) Login na Cloudflare: `cloudflared login`
2) Kreiraj tunel: `cloudflared tunnel create dev-vite`
3) Route DNS (zamijeni domenom):
   `cloudflared tunnel route dns dev-vite dev.tvoja-domena.com`
4) (Opcionalno) Konfiguracija u `~/.cloudflared/config.yml`:

```
tunnel: dev-vite
credentials-file: /Users/<ime>/.cloudflared/<id>.json
ingress:
  - hostname: dev.tvoja-domena.com
    service: http://localhost:5177
  - service: http_status:404
```

5) Pokreni tunel: `cloudflared tunnel run dev-vite`
6) Cognito Hosted UI → dodaj URL-ove:
   - Allowed callback: `https://dev.tvoja-domena.com/login`
   - Allowed sign-out: `https://dev.tvoja-domena.com/`

Napomene za Cognito
- Već koristimo dinamički redirect u kodu (`redirect_uri` / `post_logout_redirect_uri` na `window.location.origin`), pa samo dodaj odgovarajuće URL-ove u Cognito i neće trebati mijenjati kod.
- Production ostaje CloudFront domena:
  - Callback: `https://d2gka4qgf3tnzi.cloudfront.net/login`
  - Sign-out: `https://d2gka4qgf3tnzi.cloudfront.net/`

iOS/Android PWA i kamera
- Otvori HTTPS URL (tunel ili CloudFront) i dopusti kameru u postavkama preglednika.
- “Add to Home Screen” radi na HTTPS — preporuka: dodaj direktno s rute koju testiraš (npr. `/body-scan`).

Korisne npm skripte
- `npm run dev:tunnel` — quick tunnel za lokalni dev (https → localhost:5177)
- `npm run preview:tunnel` — pokrene Vite preview i tunel za test builda
- `npm run dev:lan` — primjer kako postaviti LAN HMR host (ažuriraj IP prema tvojoj mreži)

