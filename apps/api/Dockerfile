FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 8787

CMD ["bun", "apps/api/src/index.ts"]
