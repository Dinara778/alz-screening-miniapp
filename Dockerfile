# Мини-приложение + API оплат (/invoice, /prodamus/notify) на одном домене.
# Amvera: тип Docker, порт 8080. Сборка: VITE_* ; Запуск: TELEGRAM_*, PRODAMUS_*, SERVE_STATIC=true

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Сброс кэша слоя сборки при смене revision (public/build-revision.txt)
ARG BUILD_REVISION=dev
RUN echo "build revision: ${BUILD_REVISION}"

# Amvera «Сборка» → --build-arg; fallback — .env.production
ARG VITE_TELEGRAM_PAYMENTS_URL=
ARG VITE_PAYMENTS_ENABLED=true
ARG VITE_SHEETS_WEBHOOK_URL=
ARG VITE_SHARE_BOT_URL=
ENV VITE_TELEGRAM_PAYMENTS_URL=$VITE_TELEGRAM_PAYMENTS_URL
ENV VITE_PAYMENTS_ENABLED=$VITE_PAYMENTS_ENABLED
ENV VITE_SHEETS_WEBHOOK_URL=$VITE_SHEETS_WEBHOOK_URL
ENV VITE_SHARE_BOT_URL=$VITE_SHARE_BOT_URL

RUN echo "VITE_TELEGRAM_PAYMENTS_URL=${VITE_TELEGRAM_PAYMENTS_URL}" && npm run build

FROM node:20-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
WORKDIR /app
COPY server ./server
COPY --from=builder /app/dist ./dist
WORKDIR /app/server
ENV PORT=8080
ENV SERVE_STATIC=true
EXPOSE 8080
CMD ["node", "index.mjs"]
