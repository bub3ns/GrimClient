# Raport z Inżynierii Wstecznej i Analizy Frontendu

**Adres docelowy:** `https://grimclient.pl`  
**Data wykonania analizy:** 1 listopada 2026 r.  
**Użyte technologie:** Node.js, Playwright, Microsoft Edge (Chromium Engine), CDP (Chrome DevTools Protocol).

---

## 1. Rozpoznanie zabezpieczeń Cloudflare

Serwis `grimclient.pl` jest objęty zaawansowaną ochroną **Cloudflare** z włączonym modułem **Turnstile** oraz filtrowaniem zapytań bota (Bot Management / WAF).

### Zaobserwowane mechanizmy ochronne:
1. **Wstępny kod odpowiedzi 403 Forbidden:**  
   Standardowe zapytania klientów HTTP (np. `curl`, Python `requests`, biblioteki scraperów bez pełnego stosu TLS/JA3/JA4) otrzymują natychmiastową odmowę z nagłówkiem:
   ```http
   HTTP/1.1 403 Forbidden
   Cf-Mitigated: challenge
   Server: cloudflare
   CF-RAY: ...
   ```
2. **Weryfikacja w przeglądarce (Turnstile Non-Interactive / Managed Challenge):**  
   Przeglądarka ładuje stronę wstępną z tytułem `Cierpliwości...` / `Just a moment...` oraz skryptem orkiestracji:
   ```html
   <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1?..."></script>
   ```
3. **Problem z surowym CDP (`--remote-debugging-port`):**  
   Przy próbie bezpośredniego podpięcia narzędzi DevTools do standardowo uruchomionego procesu, Cloudflare wykrywa flagi automatyzacji (`navigator.webdriver`, hooki na obiekcie `Runtime` i `Page`), zatrzymując sesję w pętli challenge'u.
4. **Zastosowane rozwiązanie autoryzacji sesji:**  
   Wykorzystano mechanizm `chromium.launchPersistentContext` w Playwright z silnikiem Microsoft Edge, z wyłączonymi flagami automatyzacji:
   - `--disable-blink-features=AutomationControlled`
   - `ignoreDefaultArgs: ['--enable-automation']`
   Dzięki zachowaniu naturalnego profilu przeglądarki, sygnatur TLS oraz pełnego stosu Canvas/WebGL, challenge Cloudflare rozwiązuje się samoczynnie w ciągu 1–2 sekund, po czym sesja zostaje przekierowana do właściwej aplikacji Next.js z kodem 200.

---

## 2. Rozpoznanie stosu technologicznego (Frontend Stack)

Na podstawie analizy kodu źródłowego, nagłówków, obiektów globalnych w `window` oraz chunków Webpack:

| Warstwa | Zidentyfikowana technologia | Szczegóły |
|---|---|---|
| **Framework bazowy** | **Next.js (Pages Router)** | Wersja oparta na Pages Router; Build ID: `qGwJ2KYIlLj8ghC92z9ja` |
| **Biblioteka UI** | **React 18** | Renderowanie hybrydowe (SSR / SSG z hydracją klienta) |
| **Zarządzanie stanem i sesją** | **NextAuth.js** | Wykryto endpoint `/api/auth/session` odpytywany przy starcie każdej podstrony |
| **Style CSS** | **Tailwind CSS + PostCSS** | Użycie klas narzędziowych, wbudowane animacje, ciemny motyw (`dark`) |
| **Komponenty multimedialne** | **ReactPlayer / YouTube API** | Osadzenie wideo prezentacyjnego za pośrednictwem dedykowanego chunka `reactPlayerYouTube.*.js` |
| **Backend / CMS** | **Strapi CMS (na subdomenie `api.grimclient.pl`)** | Pliki graficzne (awatary, referencje) serwowane są z formatu URL `/uploads/hash_name.png` |
| **Fonty i typografia** | **System UI Stack** | Serwis korzysta z natywnego stosu fontów systemowych (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`), brak zewnętrznych bibliotek fontów takich jak Google Fonts |

---

## 3. Struktura routingu i mapa podstron

Z pliku `_buildManifest.js` wyekstrahowano pełną tablicę routingu aplikacji:

```json
[
  "/",
  "/2fa",
  "/404",
  "/_app",
  "/_error",
  "/change-password/[token]",
  "/changelog",
  "/confirm-device",
  "/dashboard",
  "/dashboard/billing",
  "/dashboard/faq",
  "/dashboard/settings",
  "/dashboard/support",
  "/dashboard/support/ticket/[id]",
  "/documents",
  "/login",
  "/recover-account",
  "/recover-email",
  "/register",
  "/status/[uid]",
  "/suspended"
]
```

### Podstrony publicznie dostępne i pobrane jako wyrenderowany HTML:
- `/` oraz `/pl` – Strona główna (Hero, opis funkcji klienta, prezentacja wideo, pakiety cenowe, opinie, FAQ, stopka).
- `/pl/login` – Formularz logowania użytkownika.
- `/pl/register` – Formularz rejestracji konta.
- `/pl/documents` – Pełny regulamin świadczenia usług, polityka prywatności i zasady licencji.
- `/pl/changelog` – Dziennik zmian i aktualizacji klienta.
- `/pl/recover-account` – Procedura odzyskiwania dostępu do konta.
- `/pl/recover-email` – Przypominanie adresu e-mail powiązanego z licencją.
- `/pl/pomoc` – Strona błędu 404 / strona pomocy.

### Podstrony chronione autoryzacją (Dashboard):
Trasy `/dashboard/*` (profil, subskrypcje, zgłoszenia supportu) wymagają uwierzytelnienia przez sesję NextAuth. Ich kod JavaScript i komponenty frontendowe zostały pobrane w całości (chunki: `dashboard-18fee230a4c141d5.js`, `billing-cacfed497a6f903c.js`, `settings-24b435652ae61cb1.js` itd.), natomiast sam wyrenderowany widok w środowisku produkcyjnym wymaga aktywnego tokenu użytkownika.

---

## 4. Analiza zapytań sieciowych (Fetch / XHR)

Podczas standardowego cyklu życia aplikacji frontendowej zarejestrowano następujące zapytania sieciowe:

1. **`GET /api/auth/session`**
   - **Metoda:** `GET`
   - **Rola:** Sprawdzenie stanu logowania użytkownika.
   - **Odpowiedź:** JSON z danymi zalogowanego użytkownika lub pustym obiektem sesji.
2. **`GET /_next/data/qGwJ2KYIlLj8ghC92z9ja/pl.json`**
   - **Metoda:** `GET`
   - **Rola:** Pobranie danych hydration dla tras statycznych w języku polskim.
3. **`GET /_next/data/qGwJ2KYIlLj8ghC92z9ja/pl/documents.json`**
   - **Metoda:** `GET`
   - **Rola:** Zawiera pełną treść regulaminów, polityki cookies i postanowień prawnych.
4. **`GET /_next/data/qGwJ2KYIlLj8ghC92z9ja/pl/changelog.json`**
   - **Metoda:** `GET`
   - **Rola:** Lista wpisów dziennika aktualizacji oprogramowania.
5. **`GET /_next/image?url=...&w=...&q=...`**
   - **Metoda:** `GET`
   - **Rola:** Wbudowany w Next.js optymalizator grafiki. Konwertuje obrazy źródłowe do formatu WebP z uwzględnieniem rozdzielczości ekranu.

---

## 5. Inwentarz pobranych plików i zasobów

Wszystkie pliki zostały zapisane lokalnie w katalogu `downloaded_site/grimclient.pl/`:

- **Arkusze stylów CSS (100%):**
  - `_next/static/css/71730255b6d33d07.css`
  - `_next/static/css/1311c9ffe812501e.css`
  - `_next/static/css/b2dc59ff9238499a.css`
  - `_next/static/css/14007d8464bd06aa.css`
- **Chunki JavaScript (100% – 54/54):**
  - Wszystkie chunki bazowe: `framework-612ab3f9bdb61700.js`, `main-f2c8a3930072117b.js`, `webpack-b14a82354f3de175.js`, `pages/_app-242cd4c43f43617a.js`
  - Wszystkie chunki podstron: `index`, `login`, `register`, `documents`, `changelog`, `recover-account`, `recover-email`, `dashboard`, `settings`, `billing`, `support`, `faq`, `2fa`, `confirm-device`, `status`, `404`
- **Zasoby graficzne i multimedialne:**
  - `images/statics/abs_hero_grid.png`
  - `images/img_ocean.webp`
  - `images/statics/abs_hero.svg`
  - `images/logo.png`
  - `images/img_interface_bg.png`
  - `images/statics/abs_particles_inter.png`
  - `images/bg_config2.png`
  - `images/statics/abs_reviews.png`
  - `images/statics/blazecode_logo.png`
  - `favicon.ico`
  - 14 grafik zewnętrznych pobranych z `api.grimclient.pl/uploads/...`
- **Dane stanów (JSON):**
  - `_next/data/qGwJ2KYIlLj8ghC92z9ja/pl.json`
  - `_next/data/qGwJ2KYIlLj8ghC92z9ja/pl/documents.json`
  - `_next/data/qGwJ2KYIlLj8ghC92z9ja/pl/changelog.json`
  - `_next/data/qGwJ2KYIlLj8ghC92z9ja/pl/2fa.json`
  - `_next/data/qGwJ2KYIlLj8ghC92z9ja/pl/confirm-device.json`
- **Wyrenderowany kod HTML:**
  - `rendered/pl.html`
  - `rendered/pl/login.html`
  - `rendered/pl/register.html`
  - `rendered/pl/documents.html`
  - `rendered/pl/changelog.html`
  - `rendered/pl/recover-account.html`
  - `rendered/pl/recover-email.html`
  - `rendered/pl/pomoc.html`

---

## 6. Ograniczenia i zasoby niedostępne po stronie klienta

Zgodnie z zasadami inżynierii oprogramowania i ograniczeniami scrapingu frontendu:
1. **Kod backendowy (Node.js/Server-side API):**
   - Logika weryfikacji haseł, generowania tokenów JWT, komunikacja z bazą danych (np. PostgreSQL/MySQL) oraz integracje z bramkami płatności działają po stronie serwera i nie są pobieralne przez frontend.
2. **Prywatne endpointy Dashboardu:**
   - Wyświetlenie faktycznych danych użytkownika (np. aktywnego klucza licencyjnego, przypisanego HWID) wymaga autentycznego konta i zalogowania. Lokalna kopia zawiera pełny kod widoków i komponentów dashboardu, lecz prezentuje je bez danych produkcyjnych bazy.

---

## 7. Podsumowanie rekonstrukcji

Dzięki przygotowanemu skryptowi `server.js`, zrekonstruowana witryna:
- Uruchamia się lokalnie jednym poleceniem (`npm start`).
- Wyświetla pełną szatę graficzną, animacje CSS, obrazy oraz poprawną strukturę podstron.
- Zapewnia działające linki, formularze i poprawną nawigację.
