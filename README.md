# Grim Client Frontend – Lokalna Replika & GitHub Pages

Kompletna kopia i rekonstrukcja frontendu serwisu **[grimclient.pl](https://grimclient.pl)** przygotowana do natychmiastowego hostowania na **GitHub Pages** oraz lokalnego uruchomienia.

---

## 🌐 Publikacja na GitHub Pages (Krok po kroku)

Projekt został zoptymalizowany pod statyczny hosting GitHub Pages:
- Zawiera plik `.nojekyll` (kluczowy, aby GitHub nie ignorował katalogu `_next`).
- Zawiera główny plik `index.html` oraz pełną strukturę tras w katalogu `pl/` (w tym `pl/login/`, `pl/register/`, `pl/documents/` itd.).
- Posiada wbudowany skrypt auto-detekcji bazy ścieżki (`/GrimClient/`) oraz statyczne mapowanie zoptymalizowanych obrazów Next.js.
- Posiada stronę `404.html`.

### Jak włączyć stronę na GitHubie:
1. Otwórz ustawienia swojego repozytorium:  
   👉 **[https://github.com/bub3ns/GrimClient/settings/pages](https://github.com/bub3ns/GrimClient/settings/pages)**
2. W sekcji **Build and deployment**:
   - **Source**: wybierz `Deploy from a branch`
   - **Branch**: wybierz `main` (lub `master`) oraz katalog `/ (root)`
   - Kliknij **Save**
3. Po ok. 1–2 minutach strona będzie aktywna pod adresem:  
   👉 **`https://bub3ns.github.io/GrimClient/`**

---

## 🚀 Szybki start lokalnie (Local Dev Server)

Jeśli chcesz uruchomić replikę lokalnie na własnej maszynie z emulacją backendu i API sesji:

```bash
npm install
npm start
```

Dostępne trasy lokalne:
- **Strona główna:** [http://localhost:3000/](http://localhost:3000/) lub [http://localhost:3000/pl](http://localhost:3000/pl)
- **Logowanie:** [http://localhost:3000/pl/login](http://localhost:3000/pl/login)
- **Rejestracja:** [http://localhost:3000/pl/register](http://localhost:3000/pl/register)
- **Dokumenty i regulamin:** [http://localhost:3000/pl/documents](http://localhost:3000/pl/documents)
- **Changelog:** [http://localhost:3000/pl/changelog](http://localhost:3000/pl/changelog)
- **Odzyskiwanie konta:** [http://localhost:3000/pl/recover-account](http://localhost:3000/pl/recover-account)
- **Przypomnienie e-mail:** [http://localhost:3000/pl/recover-email](http://localhost:3000/pl/recover-email)

---

## 📁 Zawartość repozytorium

```
GrimClient/
├── .nojekyll                   # Wyłącza silnik Jekyll na GitHub Pages (odblokowuje _next)
├── .gitignore                  # Ignoruje node_modules i pliki tymczasowe
├── index.html                  # Główna strona powitalna dla GitHub Pages
├── 404.html                    # Strona błędu dla routingu GitHub Pages
├── _next/                      # Wszystkie 54 chunki JS, arkusze CSS i manifesty Next.js
├── images/                     # Statyczne obrazy, grafiki wektorowe i ikony
├── external_assets/            # Pobrane awatary i grafiki z CDN api.grimclient.pl
├── pl/                         # Podstrony portalu (login, register, documents, itp.)
├── server.js                   # Lokalny serwer Node.js z obsługą optymalizacji obrazów i mocków
├── scraper.js                  # Skrypt Playwright z omijaniem detekcji bota Cloudflare
├── check_missing.js            # Weryfikator integralności pobranych chunków (54/54)
├── package.json                # Zależności i konfiguracja skryptów
├── README.md                   # Niniejsza instrukcja
└── RAPORT_ANALIZY.md           # Pełny raport inżynierii wstecznej i reverse engineeringu
```

---

## 🛠️ Inżynieria wsteczna i Cloudflare

Kompletny opis architektury, analizy nagłówków, challenge'u Cloudflare Turnstile, struktury bazy danych CMS oraz endpointów API znajduje się w pliku **[`RAPORT_ANALIZY.md`](./RAPORT_ANALIZY.md)**.
