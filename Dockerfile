# ── Stage 1: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install deps — ignore-scripts skips prisma:generate during install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY Backend/package.json ./Backend/package.json
COPY prisma/package.json  ./prisma/package.json
COPY patches/             ./patches/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source files
COPY prisma/prisma/ ./prisma/prisma/
COPY prisma/src/ ./prisma/src/
COPY prisma/scripts/ ./prisma/scripts/
COPY prisma/tsconfig.json ./prisma/tsconfig.json
COPY prisma/prisma.config.ts ./prisma/prisma.config.ts
COPY Backend/src/ ./Backend/src/
COPY Backend/tsconfig.json ./Backend/tsconfig.json
COPY Backend/eng.traineddata ./Backend/eng.traineddata

# Generate Prisma client — pass dummy DATABASE_URL so prisma.config.ts resolves
RUN cd prisma && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate --schema prisma/schema.prisma

# Build @repo/db-customer then Backend
RUN pnpm --filter @repo/db-customer build
RUN pnpm --filter Backend build

# ── Stage 2: run ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy manifests and install prod-only deps
COPY --from=builder /app/package.json          ./package.json
COPY --from=builder /app/pnpm-workspace.yaml   ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml        ./pnpm-lock.yaml
COPY --from=builder /app/Backend/package.json  ./Backend/package.json
COPY --from=builder /app/prisma/package.json   ./prisma/package.json
COPY --from=builder /app/patches/              ./patches/
RUN NODE_ENV=development pnpm install --frozen-lockfile --ignore-scripts

# Copy built output
COPY --from=builder /app/Backend/dist/         ./Backend/dist/
COPY --from=builder /app/prisma/dist/          ./prisma/dist/
COPY --from=builder /app/prisma/generated/     ./prisma/generated/
COPY --from=builder /app/prisma/prisma/        ./prisma/prisma/
COPY --from=builder /app/Backend/eng.traineddata ./Backend/eng.traineddata

RUN mkdir -p ./Backend/uploads

EXPOSE 4000
WORKDIR /app/Backend
CMD ["node", "dist/server.js"]
