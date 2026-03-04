# Dev-Auftrag: Medien-Subdomain (Public Media Hosting) für DYAI.cloud

## 1) Ziel

Unter der Subdomain `medien.dyai.cloud` soll ein einfacher Webspace entstehen, auf dem Videos, Audiodateien (MP3 etc.) und Bilder hochgeladen werden können.
Nach dem Upload muss eine öffentliche URL ausgegeben werden, die auf anderen Seiten verlinkt werden kann.

**Kernnutzen:** „Upload → URL kopieren → extern verlinken" (ohne weiteres Media-Management).

## 2) Scope (v1)

### Muss (MVP)

- **Subdomain:** `medien.dyai.cloud` (TLS/HTTPS aktiv)
- **Upload GUI (Web):**
  - Drag & Drop + File Picker
  - Progress Anzeige
  - Nach Upload: öffentliche URL anzeigen + „Copy"-Button
- **Unterstützte Dateitypen (Allowlist):**
  - Bilder: jpg, jpeg, png, webp, gif
  - Audio: mp3, wav, m4a
  - Video: mp4, webm (mindestens mp4)
- **Öffentliche Abrufbarkeit** der Dateien via URL (GET ohne Auth)
- **Upload nur für Admin** (Auth erforderlich)
- **Serverseitige Validierung:**
  - MIME-Type (Allowlist)
  - Maximalgröße pro Kategorie:
    - Bilder: 20 MB
    - Audio: 200 MB
    - Video: 2 GB
  - Sauberes Fehlerformat (keine Stacktraces an Client)

### Soll (Nice-to-have, wenn schnell)

- „Letzte Uploads"-Liste (z.B. 20 Items) mit Copy URL ✅
- Delete-Funktion für Admin ✅
- Basic Rate Limiting auf Upload-Endpoints ✅

### Nicht in v1

- Transcoding/Streaming (HLS), Video-Thumbnails
- Ordnerverwaltung, Tags, Search
- Private/expiring URLs (Signed Read URLs)
- Hotlink Protection

## 3) Nutzerrollen & Rechte

| Rolle  | Upload | Liste | Delete | GET Medien |
|--------|--------|-------|--------|------------|
| Admin  | ✅     | ✅    | ✅     | ✅         |
| Public | ❌     | ❌    | ❌     | ✅         |

## 4) Technische Architektur

- **Frontend/UI:** Next.js 14 App Router
- **API:** Next.js Route Handlers (REST)
- **Storage:** S3-kompatibles Object Storage (Cloudflare R2 / AWS S3)
- **Auth:** Session-Cookie (HMAC-signed, httpOnly)

### Upload Flow (Presigned URL)

1. Admin wählt Datei in UI
2. `POST /api/uploads` → Server validiert Metadaten und erstellt Presigned PUT URL + Key
3. UI lädt Datei direkt zum Storage hoch (PUT mit Progress)
4. UI zeigt Public URL an

## 5) API Contract

### `POST /api/uploads`
- **Auth:** required
- **Request:** `{ filename, contentType, size }`
- **Response 201:** `{ key, publicUrl, uploadUrl, expiresIn }`
- **Errors:** 400, 401, 413, 429

### `GET /api/uploads`
- **Auth:** required
- **Response:** `{ items: [{ key, publicUrl, size, lastModified }], count }`

### `DELETE /api/uploads/:key`
- **Auth:** required
- **Response:** `{ ok: true, key }`

### `POST /api/auth/login`
- **Request:** `{ password }`
- **Response:** Sets httpOnly session cookie

### `GET /api/auth/check`
- **Response:** `{ authenticated: boolean }`

## 6) Security Baseline

- ✅ Upload-Endpunkte nur mit Admin Auth (Session Cookie)
- ✅ Allowlist für Content Types + Extensions (serverseitig)
- ✅ Kein Upload von text/html, application/javascript, etc.
- ✅ Rate limit (IP-basiert) auf Upload-Endpoints
- ✅ Secrets nur via ENV
- ✅ Structured Logging (JSON)
- ✅ Keine Stacktraces an Client

## 7) Deployment

Empfohlene Optionen:
- **Vercel** (empfohlen für v1): Zero-config Next.js deployment
- **Docker auf VPS:** `Dockerfile` included
- **Cloudflare Pages:** Möglich mit Workers Adapter

### Env-Variablen (erforderlich)

```
S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
PUBLIC_BASE_URL, ADMIN_PASSWORD, SESSION_SECRET, RATE_LIMIT_RPM
```
