FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm install
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

RUN npm install --production
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=apps/api"]
