# Stage 1: 安裝依賴
FROM node:22-alpine AS deps
WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# 複製 package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/

# 安裝所有依賴
RUN pnpm install --frozen-lockfile

# Stage 2: 構建 shared
FROM deps AS build-shared
WORKDIR /app

COPY packages/shared ./packages/shared
RUN pnpm --filter @high-society/shared build

# Stage 3: 構建 frontend
FROM build-shared AS build-frontend
WORKDIR /app

ARG VITE_DISCORD_CLIENT_ID
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID

COPY packages/frontend ./packages/frontend
RUN pnpm --filter frontend build

# Stage 4: 構建 backend
FROM build-shared AS build-backend
WORKDIR /app

COPY packages/backend ./packages/backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

# Stage 5: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# 複製 package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# 只安裝 production 依賴
RUN pnpm install --frozen-lockfile --prod

# 複製構建產物
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY --from=build-frontend /app/packages/frontend/dist ./packages/frontend/dist
COPY --from=build-backend /app/packages/backend/dist ./packages/backend/dist

# 複製 Prisma schema 並生成 client
COPY packages/backend/prisma ./packages/backend/prisma
RUN pnpm --filter backend exec prisma generate

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "packages/backend/dist/index.js"]
