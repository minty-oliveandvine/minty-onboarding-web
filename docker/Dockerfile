# Development image for minty-onboarding-web (the onboarding wizard; Next.js 16).
# Optimized for local dev with hot-reload — source is bind-mounted at runtime
# (see docker-compose.yml), so we only bake in the dependencies here.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless the lockfile changes.
# Copy only the manifest + lockfile to maximize cache hits.
COPY package.json package-lock.json ./
RUN npm ci

# App source is bind-mounted over /app at runtime for hot-reload, so we don't
# COPY it here. The bind mount excludes node_modules (see compose) to keep the
# container's installed deps.

# Next.js dev server port (minty-web is 3000, minty-payment-request-web 3020).
EXPOSE 3030

# Bind to 0.0.0.0 so the dev server is reachable from the host; the port is the
# host-injected PORT, else 3030 (the same as `npm run dev`). Shell form so
# ${PORT} expands.
CMD npx next dev -H 0.0.0.0 -p ${PORT:-3030}
