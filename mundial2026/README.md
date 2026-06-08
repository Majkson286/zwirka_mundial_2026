# ⚽ Typer Mundial 2026

Aplikacja do obstawiania meczów Mistrzostw Świata 2026 ze znajomymi.
Każdy ma własne konto, typuje dokładne wyniki, a punkty liczą się automatycznie.

- **10 pkt** — dokładny wynik (np. typ 2:1, wynik 2:1)
- **5 pkt** — trafiony zwycięzca/remis, ale nie dokładny wynik
- **0 pkt** — pudło
- Obstawianie zamyka się **1 godzinę przed** pierwszym gwizdkiem
- Wszystkie 104 mecze już wczytane (terminarz fazy grupowej + placeholdery faz pucharowych)

Stack: **Cloudflare Pages** (frontend + funkcje API) + **Cloudflare D1** (baza SQLite).
W Twojej skali (kilkunastu znajomych) mieści się w **darmowym** planie Cloudflare.

---

## 🚀 Jak to postawić (krok po kroku)

Potrzebujesz tylko darmowego konta na https://cloudflare.com oraz Node.js na komputerze.

### 1. Zainstaluj narzędzia
```bash
npm install
```
(zainstaluje `wrangler` — narzędzie Cloudflare)

### 2. Zaloguj się do Cloudflare
```bash
npx wrangler login
```
Otworzy się przeglądarka — potwierdź dostęp.

### 3. Utwórz bazę danych
```bash
npx wrangler d1 create mundial2026
```
W odpowiedzi dostaniesz `database_id` — **skopiuj go** i wklej w pliku `wrangler.toml`
w miejsce `WSTAW_TUTAJ_DATABASE_ID`.

### 4. Załóż tabele w bazie
```bash
npx wrangler d1 execute mundial2026 --remote --file=schema.sql
```

### 5. Ustaw sekrety (sól do haseł + klucz seed)
```bash
npx wrangler pages secret put AUTH_SALT
# wpisz dowolny długi losowy tekst, np. abc123XYZ!@#dowolnastruna

npx wrangler pages secret put SETUP_KEY
# wpisz dowolne hasło, np. mojtajnyklucz123 — będzie potrzebne tylko raz
```
> Sekrety ustawisz po pierwszym deployu (krok 6). Jeśli wrangler poprosi o nazwę
> projektu, podaj tę samą co przy deploy (np. `mundial2026`).

### 6. Wgraj aplikację do internetu
```bash
npx wrangler pages deploy public
```
Przy pierwszym razie wrangler zapyta o nazwę projektu (np. `mundial2026`)
i utworzy adres typu `https://mundial2026.pages.dev`.

> **Ważne — powiązanie bazy z projektem Pages:**
> Wejdź na https://dash.cloudflare.com → Workers & Pages → Twój projekt
> → Settings → Functions → D1 database bindings → **Add binding**:
> - Variable name: `DB`
> - D1 database: `mundial2026`
>
> Po dodaniu binda zrób ponowny `npx wrangler pages deploy public`.

### 7. Wczytaj terminarz meczów (raz)
Otwórz w przeglądarce (podmień adres i swój SETUP_KEY):
```
https://TWOJ-ADRES.pages.dev/api/seed?key=mojtajnyklucz123
```
Metodą POST — najłatwiej z terminala:
```bash
curl -X POST "https://TWOJ-ADRES.pages.dev/api/seed?key=mojtajnyklucz123"
```
Powinno zwrócić `{"ok":true,"matches_in_db":104,...}`. Gotowe — mecze są w bazie.

### 8. Zrób siebie administratorem
Najpierw **zarejestruj się** w aplikacji (przez stronę) na swój login, np. `kuba`.
Potem nadaj sobie admina:
```bash
npx wrangler d1 execute mundial2026 --remote \
  --command="UPDATE users SET is_admin=1 WHERE username='kuba'"
```
Wyloguj się i zaloguj ponownie — pojawi się zakładka **Panel admina**.

---

## 🎮 Jak używać

- **Znajomi**: wchodzą na adres, klikają „Zarejestruj się", zakładają konto i obstawiają.
- **Ty (admin)**: po każdym meczu wchodzisz w „Panel admina", wpisujesz wynik i klikasz „Zapisz".
  Punkty wszystkich graczy przeliczą się natychmiast.
- **Fazy pucharowe**: gdy poznasz pary (np. kto wyszedł z grupy), w panelu admina możesz
  poprawić nazwy drużyn — patrz niżej.

### Uzupełnianie par fazy pucharowej
Mecze pucharowe mają na start nazwy typu „Winner C", „Runner-up A". Gdy będą znane drużyny,
zmień je przez API (przykład dla meczu nr 73):
```bash
curl -X POST "https://TWOJ-ADRES.pages.dev/api/admin-teams" \
  -H "Authorization: Bearer TWOJ_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"match_id":73,"home":"Argentina","away":"Brazil"}'
```
(TWOJ_TOKEN znajdziesz w przeglądarce: DevTools → Application → Local Storage → `m26_token`)

> Jeśli dodasz nową drużynę spoza fazy grupowej, dopisz jej flagę i polską nazwę
> w pliku `public/app.js` (obiekty `FLAGS` i `PL`) — albo zostaw, wyświetli się ⚽ i nazwa po angielsku.

---

## ⚙️ Zmiana punktacji

Edytuj `functions/api/_lib.js`:
```js
export const EXACT_PTS = 10;    // za dokładny wynik
export const OUTCOME_PTS = 5;   // za trafionego zwycięzcę
```
Po zmianie zrób `npx wrangler pages deploy public`.
> Uwaga: punkty przeliczają się przy wpisywaniu wyniku. Jeśli zmienisz zasady w trakcie,
> stare mecze zachowają stare punkty — możesz je przeliczyć cofając i wpisując wynik ponownie.

## ⏱️ Zmiana czasu blokady (domyślnie 60 min przed meczem)
W plikach `functions/api/matches.js` i `functions/api/predict.js` zmień `LOCK_MINUTES`.

---

## 🗂️ Struktura projektu
```
public/
  index.html        # wygląd aplikacji
  app.js            # logika frontendu
  schedule.json     # terminarz 104 meczów
functions/api/      # backend (Cloudflare Functions)
  register.js login.js me.js
  matches.js predict.js leaderboard.js
  admin-result.js admin-teams.js seed.js
  _lib.js           # punktacja, hasła, sesje
schema.sql          # struktura bazy
wrangler.toml       # konfiguracja
```

## 🔁 Aktualizacja aplikacji
Po każdej zmianie w kodzie:
```bash
npx wrangler pages deploy public
```

## ❓ Częste problemy
- **„no such table"** — nie wykonałeś kroku 4 (schema.sql) na `--remote`.
- **Puste mecze** — nie odpaliłeś seeda (krok 7) albo binding `DB` nie jest dodany (krok 6).
- **Brak panelu admina** — nadaj `is_admin=1` (krok 8) i przeloguj się.

Baw się dobrze! 🏆
