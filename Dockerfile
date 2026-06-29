# Мини-приложение + API оплат (/invoice, /prodamus/notify) на одном домене.
# Amvera: тип Docker, порт 8080. Сборка: VITE_* ; Запуск: TELEGRAM_*, PRODAMUS_*, SERVE_STATIC=true

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Сброс кэша слоя сборки при смене revision (public/build-revision.txt)
ARG BUILD_REVISION=dev
RUN echo "build revision: ${BUILD_REVISION}"

# Amvera «Сборка» → --build-arg; .env.production — fallback если arg пустой
ARG VITE_TELEGRAM_PAYMENTS_URL
ARG VITE_PAYMENTS_ENABLED=true
ARG VITE_SHEETS_WEBHOOK_URL
ARG VITE_SHARE_BOT_URL=
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN set -a \
  && [ -f .env.production ] && . ./.env.production \
  && set +a \
  && if [ -n "${VITE_TELEGRAM_PAYMENTS_URL}" ]; then export VITE_TELEGRAM_PAYMENTS_URL="${VITE_TELEGRAM_PAYMENTS_URL}"; fi \
  && if [ -n "${VITE_PAYMENTS_ENABLED}" ]; then export VITE_PAYMENTS_ENABLED="${VITE_PAYMENTS_ENABLED}"; fi \
  && if [ -n "${VITE_SHEETS_WEBHOOK_URL}" ]; then export VITE_SHEETS_WEBHOOK_URL="${VITE_SHEETS_WEBHOOK_URL}"; fi \
  && if [ -n "${VITE_SHARE_BOT_URL}" ]; then export VITE_SHARE_BOT_URL="${VITE_SHARE_BOT_URL}"; fi \
  && if [ -n "${VITE_SUPABASE_URL}" ]; then export VITE_SUPABASE_URL="${VITE_SUPABASE_URL}"; fi \
  && if [ -n "${VITE_SUPABASE_ANON_KEY}" ]; then export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"; fi \
  && echo "VITE_TELEGRAM_PAYMENTS_URL=${VITE_TELEGRAM_PAYMENTS_URL}" \
  && echo "VITE_SUPABASE_URL len=$(printf '%s' "${VITE_SUPABASE_URL}" | wc -c | tr -d ' ')" \
  && npm run build

FROM node:22-alpine
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
