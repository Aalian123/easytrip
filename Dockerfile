# All-in-one image: PostgreSQL + API + web in a single container.
# Meant for free single-service hosts (e.g. Render free tier) where a separate
# database is not available. The database lives inside the container, so its
# data is reset whenever the container restarts or is redeployed.
#
# Required at runtime: SEED_ADMIN_PASSWORD (the admin login password).
# Optional: SEED_ADMIN_EMAIL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, FEATURES.

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile

# The browser talks to /api on its own origin; Next proxies it to the API.
ENV NEXT_PUBLIC_API_URL=/api \
    API_PROXY_TARGET=http://127.0.0.1:3100 \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @easytrip/shared build \
  && pnpm --filter @easytrip/api exec prisma generate \
  && pnpm --filter @easytrip/api build \
  && pnpm --filter @easytrip/web build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends postgresql openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    API_PORT=3100 \
    SEED_ADMIN_EMAIL=admin@easytrip.com \
    JWT_ACCESS_TTL=15m \
    JWT_REFRESH_TTL=7d \
    FEATURES=all

EXPOSE 10000
CMD ["/usr/local/bin/start.sh"]
