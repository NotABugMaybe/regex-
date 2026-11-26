# Regex Studio

An accessible, monochrome workspace for building, testing, and understanding JavaScript regular expressions.

## Features

- Live match highlighting and match offsets in an interruptible Web Worker
- Paste text or load a local text file (TXT, CSV, JSON, MD, or LOG) and inspect matches without uploading its contents
- Pattern recipes, JavaScript flags, copy, and replacement preview
- Gemini Flash-Lite pattern generation through a server-side API
- API key protected JSON endpoints for generation, testing, and webhook delivery
- CORS preflight handling and a sample webhook receiver
- Responsive layout, keyboard navigation, visible focus styles, screen-reader announcements, and reduced-motion support

## Local setup

Requires Node.js 18+.

```sh
npm install
cp .env.example .env
```

Set `GEMINI_API_KEY` and `APP_API_KEY` in `.env`, then run:

```sh
npm run dev
```

Open the local URL shown by Vercel CLI. The `.env` file is ignored by git.

## Deploy on Vercel

Import the project into Vercel. Add `GEMINI_API_KEY` and a long random `APP_API_KEY` under Project Settings → Environment Variables, then deploy. The project uses Vercel serverless functions under `api/`, root static files, explicit deployment exclusions for local secrets, and browser security headers.

## API

See [`docs.html`](docs.html) or the deployed `/docs.html` page.

- `POST /api/v1/generate` — authenticated Gemini generation
- `POST /api/v1/regex-test` — authenticated regex testing
- `POST /api/v1/generate-and-notify` — generate and optionally POST a webhook event
- `POST /api/webhooks/echo` — sample webhook receiver
- `POST /api/generate` — public playground generation route, limited to 12 requests per minute per client IP

Versioned API endpoints require `Authorization: Bearer $APP_API_KEY`. The app never sends test text to Gemini.
