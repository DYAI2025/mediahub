# MediaHub – CLAUDE.md

## Build & Run
```bash
npm install          # Install deps
npm run dev          # Dev server on :3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
```

## Architecture
- **Next.js 14 App Router** with TypeScript + Tailwind CSS
- **API Routes:** `src/app/api/` (auth, uploads)
- **Components:** `src/components/` (LoginForm, UploadCard, RecentUploads)
- **Lib:** `src/lib/` (s3, auth, config, validation, rate-limit)
- **Storage:** S3-compatible via presigned URLs (no file goes through the server)
- **Auth:** HMAC-signed session cookies, password-based login

## Key Patterns
- All API routes check `isAuthenticated()` before processing
- Upload flow: POST metadata → get presigned URL → client PUTs directly to S3
- File validation: MIME allowlist + extension check + size limits (server-side)
- Rate limiting: in-memory per-IP (resets on restart)
- No database needed (v1) – file listing via S3 ListObjects

## Env Vars (required)
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `PUBLIC_BASE_URL`, `ADMIN_PASSWORD`
