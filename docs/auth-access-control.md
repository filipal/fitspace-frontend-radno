# Provjera zaštićenih ruta

Sljedeći koraci potvrđuju da nenajavljeni korisnik ne može pristupiti privatnim stranicama:

1. Pokreni razvojni server (`npm run dev`).
2. Otvori preglednik i idi na `http://localhost:5173/unreal-measurements`.
3. Budući da korisnik nije prijavljen, aplikacija prikazuje loader "Provjera prijave..." i zatim preusmjerava na `/login`.
4. Ponovi provjeru i za rute `/virtual-try-on`, `/loading` i `/body-scan` – svaka ruta najprije prikazuje spinner, a zatim vodi na ekran za prijavu.

Napomena: Nakon uspješne prijave prikazane rute postaju dostupne bez daljnjih preusmjeravanja.