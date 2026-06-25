# Build stage
FROM node:20-alpine AS builder

WORKDIR /workspace

COPY package*.json ./
RUN npm ci

COPY . .

# Set env to production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /workspace

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /workspace/public ./public
COPY --from=builder /workspace/.next/standalone ./
COPY --from=builder /workspace/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
