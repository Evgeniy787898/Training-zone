# Multi-stage build to reduce image size and keep runtime lean
ARG IMAGE_VERSION=dev

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ARG IMAGE_VERSION
LABEL org.opencontainers.image.version=${IMAGE_VERSION}

FROM base AS deps
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/sql ./sql

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
STOPSIGNAL SIGTERM

EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
