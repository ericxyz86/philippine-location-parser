# Repository Guidelines

## Project Structure & Module Organization
- Root directory holds high-level docs (`README.md`, `CODEBASE_ANALYSIS.md`) and quick-run scripts (`test-*.js`) that exercise shipped Google Apps Script assets.
- Primary service code lives in `app/`, with `parsers/` for PSGC-aware extraction logic, `utils/` for shared helpers (LLM wrapper, batching, caching), and `server-v5.js` as the default HTTP entry point.
- Test data and CSV fixtures sit under `app/data/` and alongside `demo-*.csv` for manual verification.
- Browser assets and scripted demos use `app/index.html` and `app/docs/`; keep new assets co-located with their owning module.

## Build, Test, and Development Commands
- Install dependencies: `npm install --prefix app` (frontend/backend bundle) and `npm install` at the repo root when adding lightweight CLI scripts.
- Start the v5 service: `npm start --prefix app` (Express server with LLM-first pipeline); legacy variants use `npm run start:v4 --prefix app`.
- Hot-reload during development: `npm run dev --prefix app` (nodemon watching `server-v5.js`).
- Run regression suite: `npm run test:all --prefix app` to execute v4 smoke tests, regression comparisons, and MCP checks.
- Spot-check quick datasets: `node test-full-dataset.js` or `node test-llm-first.js` from the repo root for targeted validation.

## Coding Style & Naming Conventions
- Use modern Node.js (ES2019+) features, two-space indentation, dangling commas avoided, and semicolons included.
- Prefer `const`/`let` over `var`, camelCase for functions and variables, PascalCase for constructors, and kebab-case filenames (`server-v5.js`, `test-social-fix.js`).
- Keep modules focused; exports should group related helpers (see `app/utils/context-detector.js`) and surface explicit factory functions.
- Document non-obvious logic with concise block comments before complex pipelines; inline comments should explain intent, not syntax.

## Testing Guidelines
- Co-locate scenario tests under `app/tests/`; follow the `test-*.js` naming pattern for discoverability.
- Each new parser or util must include regression coverage that exercises Philippine-specific edge cases (code-switching, abbreviations, barangay-only inputs).
- Run `npm test --prefix app` before pushing and attach dataset snippets or failure deltas when updating fixtures.
- For LLM-dependent paths, record mocked expectations where feasible and note any external rate limits in the PR description.

## Commit & Pull Request Guidelines
- Match existing history: short, imperative commit messages (`added footer`, `documentation`). Reference issue IDs at the end only when necessary.
- Each PR should summarize scope, list commands executed (`npm run test:all --prefix app`), and call out data or configuration impacts.
- Include screenshots or CSV diffs when UI demos (`app/index.html`) or batch exports change; link to affected docs if you update guidance.

## Environment & Security Notes
- Store secrets in `.env` (example: `OPENAI_API_KEY`, optional `PORT`); never commit keys. Sample defaults should go in `.env.example`.
- The PSGC API is unauthenticated, but OpenAI access is per-user; validate keys via the built-in `validateApiKey` helper before invoking GPT.
- Cache-heavy features use in-memory stores (`app/utils/cache-manager.js`); size choices must balance λ memory budgets and on-prem deployments.
