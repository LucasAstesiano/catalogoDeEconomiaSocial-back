FROM node:24-alpine AS builder
WORKDIR /app
ENV npm_config_nodedir=/usr/local
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_nodedir=/usr/local
COPY package*.json ./
RUN apk add --no-cache libstdc++ python3 make g++ \
  && npm ci --omit=dev \
  && npm cache clean --force \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/scripts ./scripts

USER nestjs
EXPOSE 3001
CMD ["node", "dist/main"]
