FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY Backend/package.json ./Backend/package.json
COPY prisma/package.json ./prisma/package.json
COPY patches/ ./patches/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY prisma/ ./prisma/
COPY Backend/ ./Backend/

RUN cd prisma && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate --schema prisma/schema.prisma

RUN pnpm --filter @repo/db-customer build
RUN pnpm --filter Backend build


FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/Backend/package.json ./Backend/package.json
COPY --from=builder /app/prisma/package.json ./prisma/package.json
COPY --from=builder /app/patches/ ./patches/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/Backend/dist ./Backend/dist
COPY --from=builder /app/prisma/dist ./prisma/dist
COPY --from=builder /app/prisma/prisma ./prisma/prisma
COPY --from=builder /app/Backend/eng.traineddata ./Backend/eng.traineddata

RUN mkdir -p ./Backend/uploads

EXPOSE 4000

WORKDIR /app/Backend

CMD ["node", "dist/server.js"]