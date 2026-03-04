# MediaHub – DYAI Media Hosting

Simple media hosting for `medien.dyai.cloud`. Upload images, audio, and video files → get a public URL.

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file and configure
cp .env.example .env
# Edit .env with your S3 credentials and admin password

# Run dev server
npm run dev
```

## Features

- 🖼️ **Drag & Drop Upload** with progress bar
- 🔗 **Instant public URLs** – copy & share
- 🔒 **Admin auth** (session cookie, password-based)
- ✅ **Server-side validation** (MIME types, file size limits)
- 📋 **Recent uploads list** with copy/delete
- ⚡ **Presigned URLs** – files go directly to S3 (no server bottleneck)
- 🛡️ **Rate limiting** on upload endpoints

## Supported File Types

| Category | Extensions        | Max Size |
|----------|-------------------|----------|
| Images   | jpg, png, webp, gif | 20 MB  |
| Audio    | mp3, wav, m4a     | 200 MB   |
| Video    | mp4, webm         | 2 GB     |

## Architecture

```
Browser → POST /api/uploads (metadata) → Server validates & creates presigned URL
Browser → PUT to S3 (direct upload with progress)
Browser → displays public URL
```

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import in Vercel
3. Add env variables
4. Set custom domain: `medien.dyai.cloud`

### Docker

```bash
docker build -t mediahub .
docker run -p 3000:3000 --env-file .env mediahub
```

## Environment Variables

See `.env.example` for all required variables.

## API Documentation

See [docs/dev-auftrag-medien-subdomain.md](docs/dev-auftrag-medien-subdomain.md) for full API contract and architecture details.
