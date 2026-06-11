FROM node:22-alpine AS base

# Enable corepack so pnpm is available
RUN corepack enable

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS build

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime

# Only production dependencies in the final image
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "dist/index.js"]
