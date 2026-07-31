# AGENTS.md

## Architecture
- Go monorepo with 3 binaries sharing `internal/`: API gateway (`cmd/api`), chunker (`cmd/chunker`), compiler (`cmd/compiler`).
- TypeScript translator worker: `workers/translator` (Node, RabbitMQ consumer via amqplib, compiled to `dist/` by `tsc`).
- React/Vite frontend: `frontend/` (Tailwind + shadcn/ui, `@` → `src`, React 19).
- Pipeline: API → chunker (`QUEUE_CHUNKER`) → translator (`QUEUE_TRANSLATION`) → compiler (`QUEUE_ZIP`); state in Postgres, files in Minio/S3 (buckets `epubs`, `chunks`, `translations`).

## Commands
- Infra: `docker compose up -d` (postgres, rabbitmq, minio, openobserve).
- API: `go run cmd/api/main.go` (serves :3000).
- Chunker: `go run cmd/chunker/main.go`
- Compiler: `go run cmd/compiler/main.go`
- Translator: `cd workers/translator && npm run dev` (runs `tsc -b` then `node dist/index.js`; run `npm install` first).
- Frontend: `cd frontend && npm run dev` (Vite :5173, proxies `/api` → `http://localhost:3000`).
- Frontend checks: `npm run lint` (eslint), `npm run build` (`tsc -b && vite build`).

## Database
- Schema is defined in `db/schema.sql`; apply manually: `psql "$DATABASE_URL" -f db/schema.sql`. There are no migrations and no code that creates tables.
- Row statuses are text values used directly in queries: epubs use `queued`/`in-progress`/`compiling`/`finished`/`completed`, chunks use `queued`/`processing`/`completed`/`failed`.

## Config
- All Go services load the root `.env` via `godotenv` in `internal/config/config.go`; missing vars fall back to localhost defaults matching docker-compose.
- The translator also loads the root `.env` (via `path.resolve(__dirname, "../../.env")` in `workers/translator/config.ts`), so exported env vars or a root `.env` work.
- `.env.example` mirrors what Go reads; OpenObserve auth is `OPENOBSERVE_AUTH_TOKEN` (base64 of `email:password`, sent as Basic auth), not USER/PASSWORD.

## Verification / testing
- No tests exist (Go has no `*_test.go`; frontend has no test script; translator `npm test` exits 1). Verify with `go build ./...`, `npm run lint`, `npm run build` as applicable.

## CI/CD
- `.github/workflows/docker-build.yaml`: on push to `main`, builds/pushes Go images (api/chunker/compiler) to Docker Hub (linux/arm64), ignores `frontend/**`.
- `.github/workflows/worker-build.yaml`: only triggers on `workers/**` changes; builds translator from `workers/translator/Dockerfile`.
