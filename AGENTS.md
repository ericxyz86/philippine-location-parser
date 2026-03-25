# Repository Guidelines

## Project Overview
Philippine Location Parser & Text Classifier — multi-mode text processing (location extraction, sentiment classification, category classification) using GPT-4.1-mini with batched parallel processing. Deployed on Coolify (Hetzner) at https://location-parser.aiailabs.net.

## Project Structure & Module Organization
- Primary service code lives in `app/`, with `parsers/` for PSGC-aware extraction logic, `utils/` for classifiers and helpers, and `server-v5.js` as the default HTTP entry point.
- `utils/sentiment-classifier.js` and `utils/category-classifier.js` use batched parallel classification (30 texts/call, 5 workers) — pattern from chewy-byd.
- `utils/llm-extractor.js` handles per-item location extraction with GPT-4.1-mini.
- Frontend (`app-v4.js`) chunks large datasets into batches of 50 per HTTP request to prevent proxy timeouts.
- Server endpoints use chunked Transfer-Encoding with keep-alive whitespace to prevent reverse proxy timeouts.
- Test data and CSV fixtures sit under `app/data/` and alongside `demo-*.csv` for manual verification.

## Build, Test, and Development Commands
- Install dependencies: `npm install --prefix app`
- Start v5 service: `npm start --prefix app` (Express on port 3002)
- Hot-reload: `npm run dev --prefix app` (nodemon)
- Run tests: `npm run test:all --prefix app`
- Deploy: `git push` (Coolify auto-deploys via Nixpacks, or manual redeploy from dashboard)

## Deployment Details
- **Platform:** Coolify on Hetzner CAX31
- **Build pack:** Nixpacks (not Dockerfile)
- **Install cmd:** `cd app && npm install`
- **Start cmd:** `cd app && npm start`
- **Coolify UUID:** `rcc44cw884owgk00ooo4k4c0`
- **Auth:** Cloudflare Access (email-based)
- **Domain:** https://location-parser.aiailabs.net

## Coding Style & Naming Conventions
- Modern Node.js (ES2019+), two-space indentation, semicolons included.
- `const`/`let` over `var`, camelCase functions, PascalCase constructors, kebab-case filenames.
- Keep modules focused with explicit exports.

## Key Architecture Decisions
- **Sentiment/Category modes** use `classifyAll()` which batches 30 texts per API call with 5 concurrent workers. This is ~15-30x faster than per-item classification.
- **Location mode** uses per-item extraction (concurrency 15) because structured location output doesn't batch well.
- **429 rate limit handling** uses exponential backoff (5s × attempt for rate limits).
- **Proxy timeout prevention** via chunked transfer encoding + keep-alive whitespace every 10s + `X-Accel-Buffering: no` header.
- **All model references use `gpt-4.1-mini`** across all four utility modules.

## Testing Guidelines
- Co-locate tests under `app/tests/` with `test-*.js` naming pattern.
- Each parser/util must include Philippine-specific edge case coverage.
- Run `npm test --prefix app` before pushing.

## Commit & Pull Request Guidelines
- Short imperative commit messages.
- Summarize scope, list commands executed, call out data/config impacts.

## Environment & Security
- Users provide their own OpenAI API key via browser UI (stored in localStorage).
- Optional server-side `OPENAI_API_KEY` in `.env` as fallback.
- Never commit API keys.
