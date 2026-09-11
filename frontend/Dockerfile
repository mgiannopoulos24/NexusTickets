### Build stage
FROM oven/bun:1.2.22-alpine AS builder

# Node runs Vite; Bun stays the package manager. Bun's node:http2 server
# cannot fall back to HTTP/1.1, so under Bun an https dev server serves pages
# but never completes a WebSocket upgrade (the realtime messaging socket).
RUN apk add --no-cache nodejs

WORKDIR /app

COPY package.json bun.lock ./
# --ignore-scripts skips the postinstall dev-cert generation, which needs
# files not yet copied and is irrelevant to the production static build.
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

ARG VITE_WS_URL=
ENV VITE_WS_URL=$VITE_WS_URL

RUN bun run build

### Runtime stage (nginx)
FROM nginx:1.27-alpine

COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 5173 443

HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1:5173/ >/dev/null 2>&1 || exit 1
