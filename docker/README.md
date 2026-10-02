# minty-onboarding-web — Docker (local dev)

Run the onboarding wizard locally with one command.

## Prerequisites

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).

## Run

```bash
cp .env.example .env      # from this docker/ folder
cd docker && docker compose up
```

Then open http://localhost:3030.

> If you copied `.env` while already inside `docker/`, just run `docker compose up`.

## What you get

- Next.js dev server on **port 3030** (minty-web is 3000, minty-payment-request-web 3020).
- **Hot-reload**: the repo source is bind-mounted, so edits on your host reload
  in the browser. The container keeps its own `node_modules` and `.next`.

## Configuration

Backend URLs are read from the environment (never hardcoded). Edit `.env` to
point the frontend at a different backend:

| Variable             | Default                 | Purpose                                                                          |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `PETTY_CASH_URL`     | `http://localhost:8010` | Petty Cash (the Minty Flask app), read by `lib/flaskBase.ts`.                    |
| `ONBOARDING_API_URL` | `http://localhost:8030` | minty-onboarding-api (Django). Routing lives in `lib/apiRoutes.ts`.              |

`.env.example` ships with safe local defaults — a new dev just copies it.

## Common commands

```bash
docker compose up --build     # rebuild the image (e.g. after a lockfile change)
docker compose up -d          # run detached
docker compose down           # stop and remove the container
docker compose logs -f        # follow logs
```
