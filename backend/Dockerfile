FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma on Alpine
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
RUN npx tsc --outDir dist

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget

COPY package*.json ./
RUN npm install

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/
COPY tests ./tests/
COPY vitest.config.ts ./

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/server.js"]
